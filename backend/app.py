# ============================================================
# EduPath — Python backend (Flask + Supabase)
# Деплой на Render: gunicorn app:app
# Переменные окружения: SUPABASE_URL, SUPABASE_ANON_KEY
#
# ВАЖНО: ИИ-воркер (Cloudflare) лежит отдельно: worker/ai-worker.js
# ============================================================

import os
import re
import hashlib
import requests
import traceback
from datetime import datetime, timedelta, timezone, date
from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client, Client

app = Flask(__name__)

CORS(app, origins=[
    "https://edupath1.github.io",
    "http://localhost:3000",
    "http://localhost:5000"
], supports_credentials=True)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise Exception("SUPABASE_URL and SUPABASE_ANON_KEY must be set")


def new_client() -> Client:
    """Свежий клиент на каждый запрос.
    Общий глобальный клиент нельзя: он хранит сессию последнего вошедшего
    пользователя, и запросы разных людей перемешиваются."""
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


# ============================================================
# АВТОРИЗАЦИЯ
# ============================================================

def get_user_and_client():
    """Проверяет токен и возвращает (user, client).
    client отправляет запросы в базу ОТ ИМЕНИ пользователя (его JWT),
    поэтому в политиках RLS auth.uid() = id пользователя.
    Раньше JWT не передавался -> auth.uid() был пустым ->
    'new row violates row-level security policy for table test_results'."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, None

    token = auth_header[len("Bearer "):].strip()
    if not token:
        return None, None

    try:
        client = new_client()
        user_response = client.auth.get_user(token)
        if user_response and user_response.user:
            client.postgrest.auth(token)  # <-- главное исправление
            return user_response.user, client
    except Exception:
        print("=== TOKEN ERROR ===")
        print(traceback.format_exc())

    return None, None


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user, client = get_user_and_client()
        if not user or not client:
            return jsonify({"error": "Unauthorized"}), 401
        return f(user, client, *args, **kwargs)
    return decorated


def db_error(label, e):
    print("=== " + label + " ERROR ===")
    print(traceback.format_exc())
    msg = str(e)
    if "row-level security" in msg or "42501" in msg:
        return jsonify({"error": "Нет доступа к базе данных (RLS). Сообщи команде."}), 500
    return jsonify({"error": "Ошибка сервера. Попробуй ещё раз."}), 500


# ============================================================
# HEALTH CHECK (его же можно пинговать, чтобы Render не засыпал)
# ============================================================

@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "EduPath API", "version": "1.3"})


# ============================================================
# AUTH
# ============================================================

def session_payload(session):
    if not session:
        return None
    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token
    }


def captcha_of(data):
    """Токен Cloudflare Turnstile из формы. Пока капча не включена в Supabase,
    его просто нет — тогда Supabase и не спрашивает."""
    tok = (data.get("captcha_token") or "").strip()
    return tok[:4000] or None


def auth_options(data, extra=None):
    opts = dict(extra or {})
    tok = captcha_of(data)
    if tok:
        opts["captcha_token"] = tok
    return opts


def password_leaked(password):
    """Проверка по базе утёкших паролей Have I Been Pwned (k-анонимность:
    наружу уходят только первые 5 символов SHA-1, сам пароль никуда не уходит).
    Если сервис не ответил — не мешаем регистрации."""
    try:
        h = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
        r = requests.get("https://api.pwnedpasswords.com/range/" + h[:5],
                         headers={"Add-Padding": "true", "User-Agent": "EduPath"}, timeout=4)
        if r.status_code != 200:
            return False
        tail = h[5:]
        for line in r.text.splitlines():
            part, _, count = line.partition(":")
            if part.strip() == tail and int((count or "0").strip() or 0) > 0:
                return True
    except Exception:
        print("HIBP check skipped:", traceback.format_exc(limit=1))
    return False


def password_problem(password):
    if len(password) < 8:
        return "Пароль должен быть не короче 8 символов"
    if len(password) > 72:
        return "Пароль слишком длинный (максимум 72 символа)"
    if password.isdigit() or len(set(password)) < 4:
        return "Пароль слишком простой. Добавь буквы и разные символы"
    if password_leaked(password):
        return "Этот пароль уже утёк в интернете в чужих базах. Придумай другой"
    return None


def email_allowed(client, email):
    try:
        res = client.rpc("is_email_allowed", {"p_email": email}).execute()
        return res.data is not False
    except Exception:
        print("is_email_allowed skipped:", traceback.format_exc(limit=1))
        return True


# ------------------------------------------------------------
# АНТИБОТ без капчи: ловушка (honeypot), время заполнения формы и лимит по IP.
# Капча Cloudflare не пускала живых людей из некоторых браузеров (Samsung Internet).
# ------------------------------------------------------------
MIN_FORM_MS = 2000            # быстрее 2 секунд форму заполняет только бот
REG_LIMIT_PER_IP = 5          # регистраций с одного IP...
REG_WINDOW_SEC = 3600         # ...за час
_reg_hits = {}


def client_ip():
    # Render ставит настоящий IP посетителя первым в X-Forwarded-For
    fwd = request.headers.get("X-Forwarded-For", "")
    return (fwd.split(",")[0].strip() or request.remote_addr or "?")[:64]


def ip_rate_limited(ip):
    now = datetime.now(timezone.utc).timestamp()
    hits = [t for t in _reg_hits.get(ip, []) if now - t < REG_WINDOW_SEC]
    if len(hits) >= REG_LIMIT_PER_IP:
        _reg_hits[ip] = hits
        return True
    hits.append(now)
    _reg_hits[ip] = hits
    if len(_reg_hits) > 5000:          # не даём словарю расти бесконечно
        for k in list(_reg_hits)[:2500]:
            _reg_hits.pop(k, None)
    return False


def looks_like_bot(data):
    if (data.get("website") or "").strip():
        return True
    ms = data.get("form_ms")
    if isinstance(ms, (int, float)) and 0 <= ms < MIN_FORM_MS:
        return True
    return False


DISPOSABLE_MSG = "Временные (одноразовые) почты не подходят. Используй свою обычную почту"


@app.route("/api/register", methods=["POST"])
def register():
    data = request.json or {}
    name = (data.get("name") or "").strip()[:60]
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or not password:
        return jsonify({"error": "Заполните все поля"}), 400
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email) or len(email) > 254:
        return jsonify({"error": "Проверь email"}), 400
    problem = password_problem(password)
    if problem:
        return jsonify({"error": problem, "code": "weak_password"}), 400

    # Боту отвечаем «успешно», чтобы он не понял, что его поймали. Аккаунт не создаётся.
    if looks_like_bot(data):
        print("Bot blocked at register:", client_ip())
        return jsonify({"user": {"id": None, "email": email, "name": name},
                        "session": None, "message": "Аккаунт создан"}), 200
    if ip_rate_limited(client_ip()):
        return jsonify({"error": "Слишком много регистраций с этого устройства. Попробуй через час", "code": "rate_limit"}), 429

    meta = {"name": name}
    if data.get("consent") is True:
        meta["consent_at"] = datetime.now(timezone.utc).isoformat()

    try:
        client = new_client()
        if not email_allowed(client, email):
            return jsonify({"error": DISPOSABLE_MSG, "code": "disposable_email"}), 400
        response = client.auth.sign_up({
            "email": email,
            "password": password,
            "options": auth_options(data, {"data": meta})
        })

        # Профиль (не критично). Если сессия есть — пишем от имени пользователя.
        if response.user and response.session:
            try:
                client.postgrest.auth(response.session.access_token)
                client.table("profiles").upsert({
                    "id": response.user.id,
                    "name": name
                }).execute()
            except Exception as e:
                print("Profile insert error:", e)

        return jsonify({
            "user": {
                "id": response.user.id if response.user else None,
                "email": response.user.email if response.user else None,
                "name": name
            },
            "session": session_payload(response.session),
            "message": "Аккаунт создан"
        }), 200

    except Exception as e:
        msg = str(e)
        print("=== REGISTER ERROR ===")
        print(traceback.format_exc())
        low = msg.lower()
        if "already registered" in low or "already exists" in low:
            return jsonify({"error": "Пользователь с таким email уже существует"}), 400
        if "edupath_disposable_email" in low or "database error saving new user" in low:
            return jsonify({"error": DISPOSABLE_MSG, "code": "disposable_email"}), 400
        if "captcha" in low:
            return jsonify({"error": "Проверка «я не робот» не прошла. Обнови страницу и попробуй ещё раз", "code": "captcha"}), 400
        if "rate limit" in low or "too many" in low:
            return jsonify({"error": "Слишком много регистраций. Попробуй позже", "code": "rate_limit"}), 429
        if "weak" in low or "pwned" in low or "password" in low:
            return jsonify({"error": "Пароль слишком простой или уже утёк. Придумай другой", "code": "weak_password"}), 400
        return jsonify({"error": msg}), 400


@app.route("/api/login", methods=["POST"])
def login():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Заполните все поля"}), 400

    try:
        client = new_client()
        creds = {"email": email, "password": password}
        opts = auth_options(data)
        if opts:
            creds["options"] = opts
        response = client.auth.sign_in_with_password(creds)

        user_name = ""
        try:
            if response.user and response.user.user_metadata:
                user_name = response.user.user_metadata.get("name", "")
        except Exception:
            pass

        return jsonify({
            "user": {
                "id": response.user.id,
                "email": response.user.email,
                "name": user_name
            },
            "session": session_payload(response.session)
        }), 200

    except Exception as e:
        msg = str(e)
        print("=== LOGIN ERROR ===")
        print(traceback.format_exc())
        if "email not confirmed" in msg.lower() or "email_not_confirmed" in msg.lower():
            return jsonify({"error": "Email не подтверждён. Проверь почту."}), 401
        if "captcha" in msg.lower():
            return jsonify({"error": "Проверка «я не робот» не прошла. Обнови страницу и попробуй ещё раз", "code": "captcha"}), 400
        if "invalid" in msg.lower() or "credentials" in msg.lower():
            return jsonify({"error": "Неверный email или пароль"}), 401
        return jsonify({"error": msg}), 401


@app.route("/api/refresh", methods=["POST"])
def refresh():
    """Обновляет сессию по refresh_token. Его вызывает auth.js,
    когда access_token (живёт ~1 час) истёк. Раньше маршрута не было,
    и через час профиль становился пустым, хотя «Привет, имя» оставалось."""
    data = request.json or {}
    refresh_token = (data.get("refresh_token") or "").strip()
    if not refresh_token:
        return jsonify({"error": "refresh_token required"}), 400

    try:
        client = new_client()
        response = client.auth.refresh_session(refresh_token)
        if not response or not response.session:
            return jsonify({"error": "Invalid refresh token"}), 401

        user_name = ""
        try:
            if response.user and response.user.user_metadata:
                user_name = response.user.user_metadata.get("name", "")
        except Exception:
            pass

        return jsonify({
            "user": {
                "id": response.user.id if response.user else None,
                "email": response.user.email if response.user else None,
                "name": user_name
            },
            "session": session_payload(response.session)
        }), 200
    except Exception:
        print("=== REFRESH ERROR ===")
        print(traceback.format_exc())
        return jsonify({"error": "Invalid refresh token"}), 401


@app.route("/api/resend-confirmation", methods=["POST"])
def resend_confirmation():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "Email обязателен"}), 400

    try:
        params = {"type": "signup", "email": email}
        opts = auth_options(data)
        if opts:
            params["options"] = opts
        new_client().auth.resend(params)
        return jsonify({"ok": True, "message": "Письмо отправлено заново"}), 200
    except Exception as e:
        print("=== RESEND ERROR ===")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 400


@app.route("/api/me", methods=["GET"])
@require_auth
def me(user, client):
    name = ""
    try:
        if user.user_metadata:
            name = user.user_metadata.get("name", "")
    except Exception:
        pass
    return jsonify({"user": {"id": user.id, "email": user.email, "name": name}})


# ============================================================
# SAVED UNIVERSITIES
# ============================================================

@app.route("/api/saved", methods=["GET"])
@require_auth
def get_saved(user, client):
    try:
        response = (client.table("saved_universities").select("*")
                    .eq("user_id", user.id).order("saved_at", desc=True).execute())
        return jsonify({"saved": response.data or []})
    except Exception as e:
        return db_error("GET /api/saved", e)


@app.route("/api/saved", methods=["POST"])
@require_auth
def add_saved(user, client):
    data = request.json or {}
    name = (data.get("name") or "").strip()
    country = (data.get("country") or "").strip()
    city = (data.get("city") or "").strip()

    if not name:
        return jsonify({"error": "name required"}), 400

    try:
        existing = (client.table("saved_universities").select("id")
                    .eq("user_id", user.id).eq("university_name", name).execute())
        if existing.data:
            return jsonify({"ok": True, "already": True})

        client.table("saved_universities").insert({
            "user_id": user.id,
            "university_name": name,
            "country": country,
            "city": city
        }).execute()
        return jsonify({"ok": True, "added": True})
    except Exception as e:
        if "23505" in str(e) or "duplicate key" in str(e).lower():
            return jsonify({"ok": True, "already": True})
        return db_error("POST /api/saved", e)


@app.route("/api/saved/<path:name>", methods=["DELETE"])
@require_auth
def remove_saved(user, client, name):
    try:
        (client.table("saved_universities").delete()
         .eq("user_id", user.id).eq("university_name", name).execute())
        return jsonify({"ok": True, "removed": True})
    except Exception as e:
        return db_error("DELETE /api/saved", e)


# ============================================================
# TEST RESULTS
# ============================================================

@app.route("/api/tests", methods=["GET"])
@require_auth
def get_tests(user, client):
    try:
        response = (client.table("test_results").select("*")
                    .eq("user_id", user.id).order("created_at", desc=True).execute())
        return jsonify({"tests": response.data or []})
    except Exception as e:
        return db_error("GET /api/tests", e)


@app.route("/api/tests", methods=["POST"])
@require_auth
def save_test(user, client):
    data = request.json or {}
    categories = data.get("categories") or {}
    summary = (data.get("summary") or "").strip()

    try:
        client.table("test_results").insert({
            "user_id": user.id,
            "categories": categories,
            "summary": summary
        }).execute()
        return jsonify({"ok": True})
    except Exception as e:
        return db_error("POST /api/tests", e)


# ============================================================
# ФОКУС: ТАЙМЕР УЧЁБЫ (таблица study_sessions)
# ============================================================

STUDY_MIN_SEC = 60            # меньше минуты не сохраняем
STUDY_MAX_SEC = 12 * 3600     # один таймер — не больше 12 часов
STUDY_MAX_AGE_DAYS = 14       # офлайн-очередь может прислать сессию максимум двухнедельной давности
STREAK_MIN_SEC = 15 * 60      # день идёт в серию, если за него набралось 15 минут
_CLIENT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,64}$")


def _parse_iso(value):
    if not isinstance(value, str) or not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        return None
    return dt.astimezone(timezone.utc)


def _clean_label(value):
    label = re.sub(r"\s+", " ", str(value or "")).strip()
    return label[:60]


def _streaks(day_totals, today):
    """day_totals: {date: секунды}. Серия — подряд идущие дни по 15+ минут.
    Если сегодня ещё не набралось 15 минут, серия считается до вчера (она не сгорает до конца дня)."""
    good = {d for d, s in day_totals.items() if s >= STREAK_MIN_SEC}
    cur, d = 0, today
    if d not in good:
        d = d - timedelta(days=1)
    while d in good:
        cur += 1
        d = d - timedelta(days=1)
    best, run, prev = 0, 0, None
    for d in sorted(good):
        run = run + 1 if prev is not None and (d - prev).days == 1 else 1
        best = max(best, run)
        prev = d
    return cur, best


@app.route("/api/study/sessions", methods=["POST"])
@require_auth
def add_study_session(user, client):
    data = request.json or {}
    label = _clean_label(data.get("label"))
    started = _parse_iso(data.get("started_at"))
    ended = _parse_iso(data.get("ended_at"))
    client_id = str(data.get("client_id") or "")
    try:
        duration = int(data.get("duration_sec"))
    except (TypeError, ValueError):
        duration = 0
    try:
        local_date = date.fromisoformat(str(data.get("local_date") or ""))
    except ValueError:
        local_date = None

    now = datetime.now(timezone.utc)
    if not label:
        return jsonify({"error": "Напиши, что ты учил"}), 400
    if not started or not ended or ended <= started:
        return jsonify({"error": "Неверное время сессии"}), 400
    if ended > now + timedelta(minutes=5):
        return jsonify({"error": "Время сессии в будущем"}), 400
    if ended < now - timedelta(days=STUDY_MAX_AGE_DAYS):
        return jsonify({"error": "Сессия слишком старая"}), 400
    if duration < STUDY_MIN_SEC:
        return jsonify({"error": "Меньше минуты не сохраняется"}), 400
    # активное время не может быть больше, чем прошло от старта до конца (паузы не считаются)
    duration = min(duration, int((ended - started).total_seconds()) + 60, STUDY_MAX_SEC)
    # локальная дата пользователя может отличаться от даты по UTC максимум на сутки
    if not local_date or abs((local_date - ended.date()).days) > 1:
        local_date = ended.date()
    if client_id and not _CLIENT_ID_RE.match(client_id):
        client_id = ""

    row = {
        "user_id": user.id,
        "label": label,
        "duration_sec": duration,
        "started_at": started.isoformat(),
        "ended_at": ended.isoformat(),
        "local_date": local_date.isoformat(),
    }
    if client_id:
        row["client_id"] = client_id

    try:
        client.table("study_sessions").insert(row).execute()
        return jsonify({"ok": True, "duration_sec": duration, "local_date": row["local_date"]})
    except Exception as e:
        # та же сессия уже пришла раньше (повторная отправка из офлайн-очереди)
        if "23505" in str(e) or "duplicate key" in str(e).lower():
            return jsonify({"ok": True, "already": True})
        return db_error("POST /api/study/sessions", e)


@app.route("/api/study/summary", methods=["GET"])
@require_auth
def study_summary(user, client):
    """Итоги по дням: сколько и что учил, серия дней.
    ?today=YYYY-MM-DD — сегодняшняя дата по часам пользователя, ?days=N — сколько дней показать (до 90)."""
    try:
        today = date.fromisoformat(request.args.get("today", ""))
    except ValueError:
        today = datetime.now(timezone.utc).date()
    if abs((today - datetime.now(timezone.utc).date()).days) > 1:
        today = datetime.now(timezone.utc).date()
    try:
        days = max(1, min(90, int(request.args.get("days", 30))))
    except ValueError:
        days = 30

    since = today - timedelta(days=400)
    try:
        rows, start = [], 0
        while True:  # постранично, чтобы не упереться в лимит 1000 строк
            res = (client.table("study_sessions")
                   .select("label,duration_sec,local_date")
                   .eq("user_id", user.id)
                   .gte("local_date", since.isoformat())
                   .order("local_date", desc=True)
                   .range(start, start + 999).execute())
            batch = res.data or []
            rows.extend(batch)
            if len(batch) < 1000 or len(rows) >= 20000:
                break
            start += 1000
    except Exception as e:
        return db_error("GET /api/study/summary", e)

    totals, per_day = {}, {}
    for r in rows:
        try:
            d = date.fromisoformat(r["local_date"])
        except (KeyError, TypeError, ValueError):
            continue
        sec = int(r.get("duration_sec") or 0)
        totals[d] = totals.get(d, 0) + sec
        if (today - d).days < days:
            label = _clean_label(r.get("label")) or "—"
            key = label.casefold()            # «Китайский» и «китайский» складываются
            bucket = per_day.setdefault(d, {})
            if key not in bucket:
                bucket[key] = {"label": label, "sec": 0, "count": 0}
            bucket[key]["sec"] += sec
            bucket[key]["count"] += 1

    current, best = _streaks(totals, today)
    week = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        week.append({"date": d.isoformat(), "sec": totals.get(d, 0)})
    out_days = []
    for d in sorted(per_day.keys(), reverse=True):
        items = sorted(per_day[d].values(), key=lambda x: -x["sec"])
        out_days.append({"date": d.isoformat(), "total_sec": totals.get(d, 0), "items": items})

    labels = []
    for r in rows:  # недавние названия — для подсказок в поле «Что учишь?»
        lab = _clean_label(r.get("label"))
        if lab and lab.casefold() not in {x.casefold() for x in labels}:
            labels.append(lab)
        if len(labels) >= 8:
            break

    return jsonify({
        "today": today.isoformat(),
        "today_sec": totals.get(today, 0),
        "streak": current,
        "best_streak": best,
        "streak_min_sec": STREAK_MIN_SEC,
        "week": week,
        "days": out_days,
        "recent_labels": labels,
    })


# ============================================================
# ФОКУС: СОХРАНЁННЫЕ ЦИТАТЫ (таблица saved_quotes)
# ============================================================

@app.route("/api/quotes/saved", methods=["GET"])
@require_auth
def get_saved_quotes(user, client):
    try:
        res = (client.table("saved_quotes").select("quote_id,saved_at")
               .eq("user_id", user.id).order("saved_at", desc=True).execute())
        return jsonify({"saved": [r["quote_id"] for r in (res.data or [])]})
    except Exception as e:
        return db_error("GET /api/quotes/saved", e)


@app.route("/api/quotes/saved", methods=["POST"])
@require_auth
def add_saved_quote(user, client):
    data = request.json or {}
    try:
        qid = int(data.get("quote_id"))
    except (TypeError, ValueError):
        return jsonify({"error": "quote_id required"}), 400
    if qid < 1 or qid > 10000:
        return jsonify({"error": "quote_id out of range"}), 400
    try:
        client.table("saved_quotes").insert({"user_id": user.id, "quote_id": qid}).execute()
        return jsonify({"ok": True, "added": True})
    except Exception as e:
        if "23505" in str(e) or "duplicate key" in str(e).lower():
            return jsonify({"ok": True, "already": True})
        return db_error("POST /api/quotes/saved", e)


@app.route("/api/quotes/saved/<int:qid>", methods=["DELETE"])
@require_auth
def remove_saved_quote(user, client, qid):
    try:
        (client.table("saved_quotes").delete()
         .eq("user_id", user.id).eq("quote_id", qid).execute())
        return jsonify({"ok": True, "removed": True})
    except Exception as e:
        return db_error("DELETE /api/quotes/saved", e)


# ============================================================
# ПРОФИЛЬ: гражданство и уровень обучения (общие для всех устройств)
# ============================================================

DEGREES = ("foundation", "bachelor", "master", "phd")


@app.route("/api/profile", methods=["GET"])
@require_auth
def get_profile(user, client):
    try:
        res = (client.table("profiles").select("name,citizenship,degree,consent_at,created_at")
               .eq("id", user.id).limit(1).execute())
        row = (res.data or [None])[0] or {}
        return jsonify({"profile": {
            "name": row.get("name") or "",
            "citizenship": row.get("citizenship"),
            "degree": row.get("degree"),
            "consent_at": row.get("consent_at"),
            "created_at": row.get("created_at")
        }})
    except Exception as e:
        return db_error("GET /api/profile", e)


@app.route("/api/profile", methods=["PUT", "PATCH"])
@require_auth
def update_profile(user, client):
    data = request.json or {}
    patch = {}
    if "citizenship" in data:
        cit = (data.get("citizenship") or "").strip().upper()
        if cit and not re.match(r"^[A-Z]{2}$", cit):
            return jsonify({"error": "citizenship must be a 2-letter code"}), 400
        patch["citizenship"] = cit or None
    if "degree" in data:
        deg = (data.get("degree") or "").strip().lower()
        if deg and deg not in DEGREES:
            return jsonify({"error": "unknown degree"}), 400
        patch["degree"] = deg or None
    if not patch:
        return jsonify({"error": "nothing to update"}), 400
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        res = client.table("profiles").update(patch).eq("id", user.id).execute()
        if not res.data:
            # строки профиля нет (старый аккаунт) — создаём
            name = (user.user_metadata or {}).get("name", "") if user.user_metadata else ""
            client.table("profiles").upsert(dict(patch, id=user.id, name=name)).execute()
        return jsonify({"ok": True})
    except Exception as e:
        return db_error("PUT /api/profile", e)


# ============================================================
# ВЫХОД (завершает сессию и в Supabase, а не только в браузере)
# ============================================================

@app.route("/api/logout", methods=["POST"])
def logout_route():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"ok": True})
    try:
        requests.post(SUPABASE_URL.rstrip("/") + "/auth/v1/logout?scope=local",
                      headers={"apikey": SUPABASE_ANON_KEY, "Authorization": auth_header}, timeout=8)
    except Exception:
        print("logout skipped:", traceback.format_exc(limit=1))
    return jsonify({"ok": True})


# ============================================================
# УДАЛЕНИЕ ДАННЫХ ПО ВЫБОРУ / УДАЛЕНИЕ АККАУНТА
# Лимиты (ИИ-тесты и т.п.) при этом не обнуляются — они хранятся отдельно.
# ============================================================

DELETE_PARTS = ("saved", "tests", "study", "quotes", "profile", "account")


@app.route("/api/account/delete", methods=["POST"])
@require_auth
def delete_account_data(user, client):
    data = request.json or {}
    parts = data.get("parts")
    if not isinstance(parts, list) or not parts:
        return jsonify({"error": "Выбери, что удалить"}), 400
    parts = [str(p).strip().lower() for p in parts][:10]
    if any(p not in DELETE_PARTS for p in parts):
        return jsonify({"error": "unknown part"}), 400
    if "account" in parts:
        if (data.get("confirm") or "").strip().upper() not in ("УДАЛИТЬ", "DELETE", "ЖОЮ", "删除", "ӨЧҮРҮҮ"):
            return jsonify({"error": "Чтобы удалить аккаунт, впиши слово для подтверждения"}), 400
        parts = ["account"]
    try:
        res = client.rpc("delete_my_data", {"p_parts": parts}).execute()
        return jsonify({"ok": True, "deleted": res.data or {}})
    except Exception as e:
        return db_error("POST /api/account/delete", e)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)

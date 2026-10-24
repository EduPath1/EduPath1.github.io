# ============================================================
# EduPath — Python backend (Flask + Supabase)
# Деплой на Render: gunicorn app:app
# Переменные окружения: SUPABASE_URL, SUPABASE_ANON_KEY
#
# ВАЖНО: ИИ-воркер (Cloudflare) лежит отдельно: worker/ai-worker.js
# ============================================================

import os
import traceback
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
    return jsonify({"status": "ok", "service": "EduPath API", "version": "1.1"})


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


@app.route("/api/register", methods=["POST"])
def register():
    data = request.json or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or not password:
        return jsonify({"error": "Заполните все поля"}), 400
    if len(password) < 4:
        return jsonify({"error": "Пароль минимум 4 символа"}), 400

    try:
        client = new_client()
        response = client.auth.sign_up({
            "email": email,
            "password": password,
            "options": {"data": {"name": name}}
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
        if "already registered" in msg.lower() or "already exists" in msg.lower():
            return jsonify({"error": "Пользователь с таким email уже существует"}), 400
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
        response = client.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

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
        new_client().auth.resend({"type": "signup", "email": email})
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


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)

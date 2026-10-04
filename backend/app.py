# ============================================================
# EduPath — Python backend
# Flask + Supabase Auth
# ============================================================

import os
import traceback
from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client, Client

app = Flask(__name__)

# CORS
CORS(app, origins=[
    "https://edupath1.github.io",
    "http://localhost:3000",
    "http://localhost:5000"
], supports_credentials=True)

# Supabase — переменные окружения
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise Exception("SUPABASE_URL and SUPABASE_ANON_KEY must be set")

# Глобальный клиент (для регистрации/входа)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


# ============================================================
# АВТОРИЗАЦИЯ
# ============================================================

def get_user_and_client():
    """
    Достаёт пользователя И создаёт клиент Supabase с его токеном.
    Возвращает (user, client) или (None, None).
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, None

    token = auth_header.replace("Bearer ", "").strip()
    if not token:
        return None, None

    try:
        # Отдельный клиент с токеном пользователя
        user_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        user_client.auth.set_session(token, "")

        user_response = user_client.auth.get_user()
        if user_response and user_response.user:
            return user_response.user, user_client
    except Exception as e:
        print("=== TOKEN ERROR ===")
        print(str(e))
        print(traceback.format_exc())

    return None, None


def require_auth(f):
    """Декоратор: требует авторизации. Передаёт (user, client) в функцию."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user, client = get_user_and_client()
        if not user or not client:
            return jsonify({"error": "Unauthorized"}), 401
        return f(user, client, *args, **kwargs)
    return decorated


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "EduPath API",
        "version": "1.0"
    })


# ============================================================
# AUTH
# ============================================================

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
        response = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {"data": {"name": name}}
        })

        # Пробуем записать профиль (не критично, если упадёт)
        if response.user:
            try:
                supabase.table("profiles").insert({
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
            "session": {
                "access_token": response.session.access_token if response.session else None,
                "refresh_token": response.session.refresh_token if response.session else None
            } if response.session else None,
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
        response = supabase.auth.sign_in_with_password({
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
            "session": {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token
            }
        }), 200

    except Exception as e:
        msg = str(e)
        print("=== LOGIN ERROR ===")
        print(traceback.format_exc())
        if "invalid" in msg.lower() or "credentials" in msg.lower():
            return jsonify({"error": "Неверный email или пароль"}), 401
        return jsonify({"error": msg}), 401


@app.route("/api/me", methods=["GET"])
@require_auth
def me(user, client):
    name = ""
    try:
        if user.user_metadata:
            name = user.user_metadata.get("name", "")
    except Exception:
        pass
    return jsonify({
        "user": {
            "id": user.id,
            "email": user.email,
            "name": name
        }
    })


# ============================================================
# SAVED UNIVERSITIES
# ============================================================

@app.route("/api/saved", methods=["GET"])
@require_auth
def get_saved(user, client):
    try:
        response = client.table("saved_universities") \
            .select("*") \
            .eq("user_id", user.id) \
            .order("saved_at", desc=True) \
            .execute()
        return jsonify({"saved": response.data or []})
    except Exception as e:
        print("=== GET /api/saved ERROR ===")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


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
        # Проверка дубликата
        existing = client.table("saved_universities") \
            .select("id") \
            .eq("user_id", user.id) \
            .eq("university_name", name) \
            .execute()

        if existing.data and len(existing.data) > 0:
            return jsonify({"ok": True, "already": True})

        client.table("saved_universities").insert({
            "user_id": user.id,
            "university_name": name,
            "country": country,
            "city": city
        }).execute()

        return jsonify({"ok": True, "added": True})
    except Exception as e:
        print("=== POST /api/saved ERROR ===")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


@app.route("/api/saved/<path:name>", methods=["DELETE"])
@require_auth
def remove_saved(user, client, name):
    try:
        client.table("saved_universities") \
            .delete() \
            .eq("user_id", user.id) \
            .eq("university_name", name) \
            .execute()
        return jsonify({"ok": True, "removed": True})
    except Exception as e:
        print("=== DELETE /api/saved ERROR ===")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


# ============================================================
# TEST RESULTS
# ============================================================

@app.route("/api/tests", methods=["GET"])
@require_auth
def get_tests(user, client):
    try:
        response = client.table("test_results") \
            .select("*") \
            .eq("user_id", user.id) \
            .order("created_at", desc=True) \
            .execute()
        return jsonify({"tests": response.data or []})
    except Exception as e:
        print("=== GET /api/tests ERROR ===")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


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
        print("=== POST /api/tests ERROR ===")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


# ============================================================
# ЗАПУСК
# ============================================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)

    return sorted(i["name"].lower() for key in CAT_KEYS for i in (cats.get(key) or []) if isinstance(i, dict) and i.get("name"))


def parse_ts(value):
    # Supabase отдаёт ISO-время; нужны только секунды, без внешних библиотек
    from datetime import datetime, timezone
    try:
        s = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.timestamp()
    except Exception:
        return None


@app.route("/api/tests", methods=["GET"])
@require_auth
def get_tests(user, client):
    try:
        res = (client.table("test_results").select("*")
               .eq("user_id", user.id).order("created_at", desc=True).limit(50).execute())
        return jsonify({"tests": res.data or []})
    except Exception as e:
        return server_error("get_tests", e)


@app.route("/api/tests", methods=["POST"])
@require_auth
def save_test(user, client):
    data = body()
    categories = clean_categories(data.get("categories"))
    if categories is None:
        return jsonify({"error": "Некорректный результат теста"}), 400
    summary = text(data.get("summary"), MAX_SUMMARY)

    try:
        # Тот же набор вузов за последние минуты = повторное сохранение
        # (например, после смены языка): обновляем, а не плодим дубли.
        last = (client.table("test_results").select("id, categories, created_at")
                .eq("user_id", user.id).order("created_at", desc=True).limit(1).execute())
        if last.data:
            row = last.data[0]
            ts = parse_ts(row.get("created_at"))
            same = isinstance(row.get("categories"), dict) and name_set(row["categories"]) == name_set(categories)
            if same and ts is not None and time.time() - ts < SAME_TEST_WINDOW_SEC:
                (client.table("test_results").update({"categories": categories, "summary": summary})
                 .eq("id", row["id"]).eq("user_id", user.id).execute())
                return jsonify({"ok": True, "updated": True})

        client.table("test_results").insert({
            "user_id": user.id, "categories": categories, "summary": summary,
        }).execute()
        return jsonify({"ok": True})
    except Exception as e:
        return server_error("save_test", e)


# ------------------------------------------------------------
# Запуск (на Render запускает gunicorn: gunicorn app:app)
# ------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)


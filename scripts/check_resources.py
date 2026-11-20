    for item in data["items"]:
        url = item["url"]
        status, final, err = check(url)
        if err or status is None:
            broken.append((item, f"нет ответа: {err}"))
        elif status in SOFT_CODES:
            soft.append((item, f"HTTP {status} (сайт закрыт от роботов, в браузере обычно открывается)"))
        elif status >= 400:
            broken.append((item, f"HTTP {status}"))
        elif not same_site(url, final):
            moved.append((item, f"перенаправляет на {final}"))
        else:
            ok += 1

        res = download_logo(item, refresh)
        if res == "no-logo":
            logos["no-logo"].append(item["id"])
        else:
            logos[res] += 1
        time.sleep(0.5)

    lines = [
        "# Проверка «Полезное»",
        "",
        f"Всего ссылок: {len(data['items'])} · работают: {ok} · сломаны: {len(broken)} · "
        f"переехали: {len(moved)} · закрыты от роботов: {len(soft)}",
        "",
    ]

    def block(title, rows, hint):
        if not rows:
            return
        lines.append(f"## {title}")
        lines.append(hint)
        lines.append("")
        for item, why in rows:
            lines.append(f"- **{item['name']}** (`{item['id']}`) — {item['url']} — {why}")
        lines.append("")

    block("❌ Сломаны", broken, "Найди новый официальный адрес и поправь поле `url` в resources.json (или удали карточку).")
    block("↪️ Переехали на другой сайт", moved, "Проверь вручную: если новый адрес официальный — замени `url`.")
    block("⚠️ Закрыты от роботов", soft, "Обычно это нормально. Открой ссылку в браузере: если работает, ничего делать не нужно.")
    lines.append(f"Логотипы: скачано новых {logos['saved']}, уже были {logos['kept']}, "
                 f"не нашлось {len(logos['no-logo'])} (на сайте будет буква)"
                 + (f": {', '.join(logos['no-logo'])}" if logos["no-logo"] else ""))

    report = "\n".join(lines) + "\n"
    with open(os.path.join(os.environ.get("RUNNER_TEMP", ROOT), "report.md"), "w", encoding="utf-8") as f:
        f.write(report)
    print(report)

    problems = len(broken) + len(moved)
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as f:
            f.write(f"problems={problems}\n")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(report)


if __name__ == "__main__":
    main()







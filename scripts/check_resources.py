#!/usr/bin/env python3
"""Weekly check for resources.json (the "Полезное" page).

1. Opens every link and reports dead ones (4xx/5xx, timeouts) and ones that
   now redirect to a different website.
2. Downloads missing logos into assets/logos/<id>.png so the page does not
   depend on third-party servers.

Only the Python standard library is used. Writes report.md (to $RUNNER_TEMP on GitHub) and sets the
GitHub output "problems" to the number of broken/moved links.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "resources.json")
LOGOS = os.path.join(ROOT, "assets", "logos")
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/124.0 Safari/537.36 EduPath-link-check")
TIMEOUT = 25
# Sites behind anti-bot protection often answer 403/429 to robots, but work in a browser.
SOFT_CODES = {401, 403, 429}


def base_host(url):
    host = urllib.parse.urlparse(url).hostname or ""
    host = host.lower()
    return host[4:] if host.startswith("www.") else host


def same_site(a, b):
    a, b = base_host(a), base_host(b)
    return a == b or a.endswith("." + b) or b.endswith("." + a)


def fetch(url, method="GET"):
    req = urllib.request.Request(url, method=method, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en,ru;q=0.8",
    })
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.status, resp.geturl(), resp.read(200_000)


def check(url):
    last_err = None
    for attempt in range(2):
        try:
            status, final, _ = fetch(url)
            return status, final, None
        except urllib.error.HTTPError as e:
            return e.code, e.geturl() or url, None
        except Exception as e:  # timeouts, DNS, TLS
            last_err = str(e)[:160]
            time.sleep(3)
    return None, url, last_err


def download_logo(item, refresh=False):
    os.makedirs(LOGOS, exist_ok=True)
    path = os.path.join(LOGOS, f"{item['id']}.png")
    if os.path.exists(path) and not refresh:
        return "kept"
    host = urllib.parse.urlparse(item["url"]).hostname
    src = "https://www.google.com/s2/favicons?sz=128&domain=" + urllib.parse.quote(host or "")
    try:
        status, _, body = fetch(src)
        # A real PNG starts with these bytes; tiny files are Google's default globe.
        if status == 200 and body[:8] == b"\x89PNG\r\n\x1a\n" and len(body) > 600:
            with open(path, "wb") as f:
                f.write(body)
            return "saved"
        return "no-logo"
    except Exception:
        return "no-logo"


def main():
    refresh = "--refresh-logos" in sys.argv
    with open(DATA, encoding="utf-8") as f:
        data = json.load(f)

    broken, moved, soft, ok = [], [], [], 0
    logos = {"saved": 0, "kept": 0, "no-logo": []}

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

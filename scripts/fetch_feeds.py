#!/usr/bin/env python3
"""Builds feed.json for the "Контент" page (content.html).

Reads the list of sources from feeds.json and collects:
  * videos  — from YouTube channel RSS (no API key needed), Shorts are skipped;
  * news    — from RSS/Atom feeds, or from an official news page when a site has no RSS.

Only titles, a short teaser (up to ~200 characters), the source and a link are stored.
Full articles are never copied. Every click on the site leads to the original page.

Only the Python standard library is used. Nothing here costs money: no AI, no Tavily,
no Supabase, no Cloudflare. Runs in GitHub Actions every 3 hours.

Outputs:
  feed.json   — written only when the list of items really changed (no empty commits);
  report.md   — problems (broken sources, silent channels) for the GitHub Issue;
  GitHub output "problems" — number of problems.
"""
import email.utils
import hashlib
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, "feeds.json")
OUT = os.path.join(ROOT, "feed.json")
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/124.0 Safari/537.36 EduPath-content-bot")
TIMEOUT = 25
NOW = datetime.now(timezone.utc)

NEWS_MAX_AGE_DAYS = 30
VIDEO_MAX_AGE_DAYS = 180
SILENT_CHANNEL_DAYS = 90
TEASER_LEN = 200
MAX_SHORTS_CHECKS = 200          # per run, keeps the job fast
MAX_COVER_CHECKS = 150           # news pages opened per run to find a cover image
DEFAULT_PER_SOURCE = 10           # max items of one source in the final list
TOTAL_NEWS = 120
TOTAL_VIDEOS = 120


# ---------------------------------------------------------------- network
class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


_NO_REDIRECT = urllib.request.build_opener(_NoRedirect)


def fetch(url, accept="*/*"):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept": accept,
        "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
        # avoids the EU cookie wall on YouTube pages
        "Cookie": "CONSENT=YES+1; SOCS=CAI",
    })
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        data = r.read(6_000_000)
        charset = r.headers.get_content_charset() or "utf-8"
    return data, charset


def fetch_text(url, accept="*/*"):
    data, charset = fetch(url, accept)
    try:
        return data.decode(charset, errors="replace")
    except LookupError:
        return data.decode("utf-8", errors="replace")


def is_short(video_id):
    """youtube.com/shorts/<id> answers 200 for a Short and redirects for a normal video."""
    req = urllib.request.Request("https://www.youtube.com/shorts/" + video_id,
                                 headers={"User-Agent": UA, "Cookie": "CONSENT=YES+1; SOCS=CAI"},
                                 method="HEAD")
    try:
        with _NO_REDIRECT.open(req, timeout=15) as r:
            return r.status == 200
    except urllib.error.HTTPError as e:
        return False if 300 <= e.code < 400 else None
    except Exception:
        return None


# ---------------------------------------------------------------- helpers
def clean_text(s):
    s = re.sub(r"(?is)<(script|style).*?</\1>", " ", s or "")
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def teaser(s):
    s = clean_text(s)
    # typical WordPress tails
    s = re.sub(r"\s*The post .{0,200}? appeared first on .{0,80}?\.?$", "", s)
    s = re.sub(r"\s*\[(…|\.\.\.)\]\s*$", "", s)
    if len(s) <= TEASER_LEN:
        return s
    cut = s[:TEASER_LEN]
    cut = cut[:cut.rfind(" ")] if " " in cut else cut
    return cut.rstrip(",.;:—- ") + "…"


def parse_date(s):
    if not s:
        return None
    s = s.strip()
    try:
        d = email.utils.parsedate_to_datetime(s)
        if d:
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError, IndexError):
        pass
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def iso(d):
    return d.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def item_id(url):
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:14]


def safe_url(u, base=None):
    if not u:
        return ""
    u = html.unescape(u.strip())
    if base:
        u = urllib.parse.urljoin(base, u)
    p = urllib.parse.urlparse(u)
    return u if p.scheme in ("http", "https") and p.netloc else ""


def base_host(url):
    h = (urllib.parse.urlparse(url).hostname or "").lower()
    return h[4:] if h.startswith("www.") else h


def local(tag):
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def child(el, name):
    for c in el:
        if local(c.tag) == name:
            return c
    return None


def children(el, name):
    return [c for c in el if local(c.tag) == name]


def find_deep(el, name):
    for c in el.iter():
        if local(c.tag) == name:
            return c
    return None


# ---------------------------------------------------------------- parsers
def parse_feed(xml_text, base_url):
    """RSS 2.0 / Atom / RDF → list of dicts (title, url, summary, date, img)."""
    xml_text = re.sub(r"^[^<]+", "", xml_text)  # BOM / garbage before XML
    root = ET.fromstring(xml_text.encode("utf-8"))
    entries = [e for e in root.iter() if local(e.tag) in ("item", "entry")]
    out = []
    for e in entries:
        title = clean_text((child(e, "title").text or "") if child(e, "title") is not None else "")
        link = ""
        for l in children(e, "link"):
            href = l.get("href")
            if href and l.get("rel", "alternate") == "alternate":
                link = href
                break
            if not href and (l.text or "").strip():
                link = l.text.strip()
                break
        if not link:
            g = child(e, "guid")
            if g is not None and (g.text or "").startswith("http"):
                link = g.text.strip()
        summary = ""
        for n in ("description", "summary", "encoded", "content"):
            c = child(e, n)
            if c is not None and (c.text or "").strip():
                summary = c.text
                break
        date = None
        for n in ("pubDate", "published", "updated", "date", "issued"):
            c = child(e, n)
            if c is not None and c.text:
                date = parse_date(c.text)
                if date:
                    break
        img = ""
        for c in e.iter():
            ln = local(c.tag)
            if ln == "thumbnail" and c.get("url"):
                img = c.get("url"); break
            if ln == "content" and c.get("url") and (c.get("medium") == "image" or
                                                     (c.get("type") or "").startswith("image")):
                img = c.get("url"); break
            if ln == "enclosure" and (c.get("type") or "").startswith("image") and c.get("url"):
                img = c.get("url"); break
        if not img and summary:
            m = re.search(r'<img[^>]+src="([^"]+)"', summary)
            if m:
                img = m.group(1)
        url = safe_url(link, base_url)
        if title and url:
            out.append({"title": title, "url": url, "summary": summary, "date": date,
                        "img": safe_url(img, base_url)})
    return out


def discover_feed(page_html, page_url):
    for m in re.finditer(r"<link\b[^>]*>", page_html, re.I):
        tag = m.group(0)
        if re.search(r'type=["\']application/(rss|atom)\+xml', tag, re.I):
            h = re.search(r'href=["\']([^"\']+)', tag, re.I)
            if h:
                u = safe_url(h.group(1), page_url)
                # skip "comments" feeds
                if u and "comment" not in u.lower():
                    return u
    return ""


NAV_WORDS = re.compile(r"(?i)^(home|главная|contact|контакт|about|о нас|login|войти|search|поиск|"
                       r"privacy|cookies?|terms|sitemap|faq|menu|меню|read more|подробнее|далее|"
                       r"more|ещё|все новости|all news|next|previous|back)\b")


def parse_news_page(page_html, page_url, pattern=None, limit=10):
    """Fallback for official sites without RSS: takes article-like links from a news page."""
    host = base_host(page_url)
    seen, out = set(), []
    body = re.sub(r"(?is)<(header|nav|footer|script|style)\b.*?</\1>", " ", page_html)
    for m in re.finditer(r'<a\b[^>]*href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', body, re.I | re.S):
        url = safe_url(m.group(1), page_url)
        title = clean_text(m.group(2))
        if not url or base_host(url) != host and not base_host(url).endswith("." + host):
            continue
        path = urllib.parse.urlparse(url).path
        if pattern:
            if not re.search(pattern, path):
                continue
        else:
            if len(title) < 25 or len(title) > 200 or NAV_WORDS.search(title):
                continue
            if len(title.split()) < 4:   # "John Steinbeck" — a person page, not news
                continue
            if len([p for p in path.split("/") if p]) < 2:
                continue
            if re.search(r"\.(pdf|docx?|xlsx?|jpg|png|zip)$", path, re.I):
                continue
        if len(title) < 12:
            continue
        key = url.split("?")[0].rstrip("/")
        if key in seen or key == page_url.split("?")[0].rstrip("/"):
            continue
        seen.add(key)
        out.append({"title": title, "url": url, "summary": "", "date": None, "img": ""})
        if len(out) >= limit:
            break
    return out


# ---------------------------------------------------------------- youtube
def resolve_channel(src, cache, info):
    if src.get("channel_id"):
        return src["channel_id"]
    key = src["id"]
    if cache.get(key):
        return cache[key]
    cid = ""
    if src.get("handle"):
        try:
            page = fetch_text("https://www.youtube.com/" + src["handle"].strip("/"))
            m = (re.search(r'<link rel="canonical" href="https://www\.youtube\.com/channel/(UC[\w-]{22})"', page)
                 or re.search(r'"externalId":"(UC[\w-]{22})"', page)
                 or re.search(r'itemprop="identifier" content="(UC[\w-]{22})"', page))
            if m:
                cid = m.group(1)
        except Exception:
            cid = ""
    if not cid and src.get("search", src.get("name")):
        q = src.get("search") or src["name"]
        try:
            page = fetch_text("https://www.youtube.com/results?search_query=" +
                              urllib.parse.quote(q) + "&sp=EgIQAg%3D%3D")  # filter: channels
            m = re.search(r'"channelId":"(UC[\w-]{22})"', page)
            if m:
                cid = m.group(1)
                info.append(f"- **{src['name']}** найден поиском по названию «{q}» → "
                            f"https://www.youtube.com/channel/{cid} — проверь, что это нужный канал. "
                            f"Если да, впиши в feeds.json: \"channel_id\": \"{cid}\"")
        except Exception:
            cid = ""
    if cid:
        cache[key] = cid
    return cid


def collect_youtube(src, cache, shorts, budget, info):
    cid = resolve_channel(src, cache, info)
    if not cid:
        raise RuntimeError("не удалось найти канал (проверь handle или впиши channel_id)")
    xml_text = fetch_text("https://www.youtube.com/feeds/videos.xml?channel_id=" + cid,
                          "application/atom+xml,application/xml")
    root = ET.fromstring(xml_text.encode("utf-8"))
    include = [w.lower() for w in src.get("include", [])]
    exclude = [w.lower() for w in src.get("exclude", [])]
    items, newest = [], None
    for e in [x for x in root if local(x.tag) == "entry"]:
        vid_el = find_deep(e, "videoId")
        vid = (vid_el.text or "").strip() if vid_el is not None else ""
        title = clean_text(child(e, "title").text if child(e, "title") is not None else "")
        date = parse_date((child(e, "published").text or "") if child(e, "published") is not None else "")
        if not vid or not title:
            continue
        if date and (newest is None or date > newest):
            newest = date
        low = title.lower()
        if include and not any(w in low for w in include):
            continue
        if exclude and any(w in low for w in exclude):
            continue
        if "#shorts" in low:
            continue
        if vid not in shorts and budget[0] > 0:
            budget[0] -= 1
            res = is_short(vid)
            if res is not None:
                shorts[vid] = res
        if shorts.get(vid):
            continue
        desc_el = find_deep(e, "description")
        items.append({
            "title": title,
            "url": "https://www.youtube.com/watch?v=" + vid,
            "summary": (desc_el.text or "") if desc_el is not None else "",
            "date": date,
            "img": f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg",
            "video_id": vid,
        })
    return items, newest, cid


# ---------------------------------------------------------------- covers
def find_cover(url):
    """Cover picture of an article: the same og:image that Telegram/WhatsApp show in link previews."""
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*",
                                               "Accept-Language": "en-US,en;q=0.9,ru;q=0.8"})
    with urllib.request.urlopen(req, timeout=15) as r:
        data = r.read(400_000)
        charset = r.headers.get_content_charset() or "utf-8"
    try:
        page = data.decode(charset, errors="replace")
    except LookupError:
        page = data.decode("utf-8", errors="replace")
    head = page.split("</head>", 1)[0]
    for prop in ("og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"):
        for m in re.finditer(r"<meta\b[^>]*>", head, re.I):
            tag = m.group(0)
            if re.search(r'(property|name)=["\']' + re.escape(prop) + r'["\']', tag, re.I):
                c = re.search(r'content=["\']([^"\']+)', tag, re.I)
                u = safe_url(c.group(1), url) if c else ""
                if u and not re.search(r"\.svg(\?|$)", u, re.I):
                    return u
    m = re.search(r'<link\b[^>]*rel=["\']image_src["\'][^>]*href=["\']([^"\']+)', head, re.I)
    return safe_url(m.group(1), url) if m else ""


# ---------------------------------------------------------------- main
def classify(src, title, summary, rules):
    if not src.get("auto_topic"):
        return src["topic"]
    hay = (title + " " + clean_text(summary)).lower()
    for r in rules:
        if any(w.lower() in hay for w in r["words"]):
            return r["topic"]
    return src["topic"]


def city_tag(title, cities):
    low = title.lower()
    for c in cities:
        for w in c["words"]:
            if re.search(r"(?<![\w])" + re.escape(w.lower()) + r"(?![\w])", low):
                return c["id"]
    return ""


def main():
    with open(CONFIG, encoding="utf-8") as f:
        cfg = json.load(f)
    old = {"items": [], "state": {}}
    if os.path.exists(OUT):
        try:
            with open(OUT, encoding="utf-8") as f:
                old = json.load(f)
        except Exception:
            pass
    state = old.get("state") or {}
    yt_cache = state.get("yt_ids", {})
    shorts = state.get("shorts", {})
    covers = state.get("covers", {})
    cover_budget = [MAX_COVER_CHECKS]
    budget = [MAX_SHORTS_CHECKS]

    sources = [s for s in cfg["sources"] if not s.get("disabled")]
    src_by_id = {s["id"]: s for s in sources}
    old_items = {it["id"]: it for it in old.get("items", []) if it.get("source") in src_by_id}

    rules = cfg.get("topic_rules", [])
    cities = cfg.get("cities", [])
    problems, info = [], []
    fresh = {}

    for src in sources:
        name = src.get("name", src["id"])
        try:
            if src["type"] == "youtube":
                raw, newest, cid = collect_youtube(src, yt_cache, shorts, budget, info)
                if newest is None or NOW - newest > timedelta(days=SILENT_CHANNEL_DAYS):
                    when = newest.date().isoformat() if newest else "никогда"
                    problems.append(f"- 💤 **{name}** — канал молчит больше {SILENT_CHANNEL_DAYS} дней "
                                    f"(последнее видео: {when}). Реши: оставить или выключить "
                                    f"(\"disabled\": true в feeds.json). https://www.youtube.com/channel/{cid}")
            elif src["type"] == "rss":
                raw = parse_feed(fetch_text(src["url"], "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*"), src["url"])
            elif src["type"] == "page":
                page = fetch_text(src["url"], "text/html,*/*")
                feed_url = "" if src.get("pattern") else discover_feed(page, src["url"])
                raw = []
                if feed_url:
                    try:
                        raw = parse_feed(fetch_text(feed_url), feed_url)
                    except Exception:
                        raw = []
                if not raw:
                    raw = parse_news_page(page, src["url"], src.get("pattern"))
            else:
                raise RuntimeError("неизвестный type: " + src["type"])
        except Exception as e:  # one broken source must not stop the others
            msg = str(e)
            if isinstance(e, urllib.error.HTTPError):
                msg = f"HTTP {e.code}"
            elif isinstance(e, ET.ParseError):
                msg = "ответ не похож на RSS/XML"
            problems.append(f"- ❌ **{name}** ({src.get('url') or src.get('handle') or src.get('search', '')}) — {msg[:160]}")
            continue

        kind = src["kind"]
        max_age = timedelta(days=VIDEO_MAX_AGE_DAYS if kind == "video" else NEWS_MAX_AGE_DAYS)
        n = 0
        for r in raw:
            iid = item_id(r["url"])
            prev = old_items.get(iid)
            date = r["date"] or (parse_date(prev["date"]) if prev else None) or NOW
            if NOW - date > max_age:
                continue
            title = r["title"][:220]
            it = {
                "id": iid,
                "kind": kind,
                "source": src["id"],
                "sname": name,
                "lang": src.get("lang", "en"),
                "topic": classify(src, title, r["summary"], rules),
                "title": title,
                "teaser": teaser(r["summary"]) if kind == "news" else "",
                "url": r["url"],
                "img": r["img"],
                "date": iso(date),
            }
            if kind == "video":
                it["vid"] = r.get("video_id", "")
                if it["topic"] == "walks":
                    tag = city_tag(title, cities)
                    if tag:
                        it["city"] = tag
            if src.get("official"):
                it["official"] = True
            if kind == "news" and not it["img"] and not src.get("no_cover"):
                if iid in covers:
                    it["img"] = covers[iid]
                elif cover_budget[0] > 0:
                    cover_budget[0] -= 1
                    try:
                        covers[iid] = find_cover(it["url"])
                    except Exception:
                        covers[iid] = ""
                    it["img"] = covers[iid]
            fresh[iid] = it
            n += 1
        if not raw:
            problems.append(f"- ⚠️ **{name}** — источник открылся, но записей не найдено "
                            f"({src.get('url') or src.get('handle') or src.get('search', '')})")

    # keep older items of sources that failed this time (so the page never goes empty)
    for iid, it in old_items.items():
        if iid in fresh:
            continue
        d = parse_date(it.get("date"))
        max_age = timedelta(days=VIDEO_MAX_AGE_DAYS if it["kind"] == "video" else NEWS_MAX_AGE_DAYS)
        if d and NOW - d <= max_age:
            fresh[iid] = it

    # cap per source and in total, newest first
    items = sorted(fresh.values(), key=lambda x: x["date"], reverse=True)
    per, final = {}, []
    totals = {"news": 0, "video": 0}
    for it in items:
        cap = src_by_id[it["source"]].get("max", DEFAULT_PER_SOURCE)
        if per.get(it["source"], 0) >= cap:
            continue
        limit = TOTAL_VIDEOS if it["kind"] == "video" else TOTAL_NEWS
        if totals[it["kind"]] >= limit:
            continue
        per[it["source"]] = per.get(it["source"], 0) + 1
        totals[it["kind"]] += 1
        final.append(it)

    keep_vids = {it.get("vid") for it in final if it.get("vid")}
    keep_ids = {it["id"] for it in final}
    covers = {k: v for k, v in covers.items() if k in keep_ids}
    # remember checked non-Shorts of recent items; forget the rest so the file stays small
    shorts = {k: v for k, v in shorts.items() if k in keep_vids or v}
    if len(shorts) > 3000:
        shorts = dict(list(shorts.items())[-3000:])

    changed = ([(i["id"], i["date"], i["topic"], i["title"], i["img"]) for i in final] !=
               [(i["id"], i["date"], i["topic"], i["title"], i.get("img", "")) for i in old.get("items", [])]) \
        or yt_cache != state.get("yt_ids", {})
    if changed:
        out = {
            "updated": iso(NOW),
            "counts": totals,
            "items": final,
            "state": {"yt_ids": yt_cache, "shorts": shorts, "covers": covers},
        }
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        print(f"feed.json обновлён: {totals['news']} новостей, {totals['video']} видео")
    else:
        print("Новых записей нет — feed.json не меняется")

    report = ["## Лента «Контент»: что требует внимания", "",
              f"Проверено источников: {len(sources)}. Новостей: {totals['news']}, видео: {totals['video']}.", ""]
    report += problems or ["Проблем нет 🎉"]
    if info:
        report += ["", "### К сведению (не ошибка)", ""] + info
    report += ["", "_Этот Issue обновляется автоматически. Когда проблем не останется, он закроется сам._"]
    report_dir = os.environ.get("RUNNER_TEMP") or ROOT
    with open(os.path.join(report_dir, "content-report.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(report) + "\n")
    print("\n".join(report))
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as f:
            f.write(f"problems={len(problems)}\n")


if __name__ == "__main__":
    sys.exit(main())

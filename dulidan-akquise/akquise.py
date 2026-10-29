#!/usr/bin/env python3
"""
Dulidan Studios – Akquise-Tool (Kern)

Die Oberfläche startest du mit einem Doppelklick auf start.bat (oder: python app.py).

Kommandozeile geht weiterhin:
  python akquise.py suchen [--region X] [--branche Y] [--umkreis 15]
  python akquise.py nachpruefen | websuche | antworten | status | ordner
  python akquise.py senden [--live] [--anzahl N]
"""
import argparse
import codecs
import copy
import csv
import datetime as dt
import email
import email.policy
import email.utils
import html as htmllib
import imaplib
import json
import logging
import math
import os
import random
import re
import smtplib
import ssl
import sys
import threading
import time
import tomllib
from concurrent.futures import ThreadPoolExecutor, as_completed
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

import certifi
import requests

BASE = Path(__file__).resolve().parent
CONFIG_TOML = BASE / "config.toml"
SECRETS_JSON = BASE / "secrets.json"
USAGE_JSON = BASE / "usage.json"
LEADS_CSV = BASE / "leads.csv"
CONTACTED_CSV = BASE / "contacted_companies.csv"
BLOCKLIST = BASE / "blocklist.txt"
VORLAGEN_DIR = BASE / "vorlagen"
LOG_DIR = BASE / "logs"

# certifi statt Windows-Zertifikatsspeicher: dem fehlt oft die Telekom-CA, die IONOS nutzt
TLS = ssl.create_default_context(cafile=certifi.where())

LEAD_FIELDS = ["place_id", "firma", "branche", "region", "ort", "adresse", "telefon", "website",
               "website_status", "score", "email", "anrede", "status", "gefunden_am", "maps_url", "email_quelle",
               "notiz", "kategorie"]
CONTACTED_FIELDS = ["firma", "email", "datum", "website_status", "website", "branche", "ort",
                    "telefon", "anrede", "geantwortet", "antwort_datum", "place_id"]

DEFAULT_CONFIG = {
    "suche": {
        "regionen": ["Öhringen"],
        "branchen": ["Zimmerei"],
        "umkreis_km": 20,                  # 0 = nur die Ortsgrenzen laut Google
        "min_schlecht_score": 2,
        "website_veraltet_ab_jahren": 4,
        "max_google_anfragen_pro_suche": 150,
        "parallel": 6,                     # Websites gleichzeitig prüfen
        # Treffer mit diesen Google-Kategorien / Namensteilen gelten als "andere Branche" und werden nicht angeschrieben
        "ausschliessen_kategorien": ["Arzt", "Zahnarzt", "Physiotherapeut", "Poliklinik", "Gesundheit", "Fußpflege",
                                     "Immobilienagentur", "Versicherungsagentur", "Behörde", "Kommunalverwaltung",
                                     "Postamt", "Apartmenthaus", "Beherbergung", "POI - Ort von Interesse",
                                     "Vereinigung / Organisation", "Veranstaltungsstätte", "Barbecuebereich",
                                     "Versanddienstleister", "Transportdienst", "Bekleidungsgeschäft", "Sportgeschäft",
                                     "Geschäftsstelle", "Berater"],
        "ausschliessen_woerter": ["Immobilien", "Praxis", "Therap", "Heilprakt", "Psycholog", "Versicherung",
                                  "Hausverwaltung", "Physio", "Fußpflege", "Podo", "Medien", "Transporte"],
    },
    "suchbegriffe": {"Zimmerei": ["Holzbau", "Zimmerer"]},
    "versand": {
        "max_mails_pro_tag": 20,
        "pause_min_sekunden": 90,
        "pause_max_sekunden": 240,
        "betreff": "Kurze Idee zu Ihrer Website",
        "absender_name": "Shaquille El Moussaoui",
        "absender_email": "info@dulidan-studios.com",
        "anrede_fallback": "Guten Tag,",
    },
    "smtp": {"host": "smtp.ionos.de", "port": 587, "user": "info@dulidan-studios.com"},
    "imap": {"host": "imap.ionos.de", "port": 993, "gesendet_ordner": "Gesendete Objekte",
             "im_gesendet_ablegen": True},
    "websuche": {"aktiv": True, "max_seiten_oeffnen": 3},
    "google": {},
}

log = logging.getLogger("akquise")

# Abbrechen aus der Oberfläche heraus
STOP = threading.Event()
# alle Lese-/Schreibzugriffe auf CSV/JSON laufen hierüber, damit Oberfläche und Hintergrund-Jobs sich nicht überschreiben
DATA_LOCK = threading.RLock()


class Stopped(Exception):
    pass


def check_stop():
    if STOP.is_set():
        raise Stopped()


def wait(seconds):
    if STOP.wait(seconds):
        raise Stopped()


# ---------------------------------------------------------------- Konfiguration

def _merge(base, over):
    out = dict(base)
    for k, v in over.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict) and k != "suchbegriffe":
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def load_secrets():
    try:
        return json.loads(SECRETS_JSON.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        return {}


def save_secrets(updates):
    with DATA_LOCK:
        sec = load_secrets()
        sec.update({k: v for k, v in updates.items() if v})
        SECRETS_JSON.write_text(json.dumps(sec, indent=2), encoding="utf-8")


def load_config(path=CONFIG_TOML):
    cfg = copy.deepcopy(DEFAULT_CONFIG)
    if Path(path).exists():
        with open(path, "rb") as f:
            cfg = _merge(cfg, tomllib.load(f))
    sec = load_secrets()
    cfg["google"]["api_key"] = sec.get("google_api_key") or os.environ.get("GOOGLE_MAPS_API_KEY", "")
    cfg["smtp"]["password"] = sec.get("ionos_password") or os.environ.get("IONOS_PASSWORD", "")
    cfg["websuche"]["api_key"] = sec.get("brave_api_key") or os.environ.get("BRAVE_API_KEY", "")
    return cfg


def _toml_value(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        return "[" + ", ".join(_toml_value(x) for x in v) + "]"
    return json.dumps(str(v), ensure_ascii=False)


def save_config(cfg, path=CONFIG_TOML):
    lines = ["# Dulidan Studios – Akquise-Konfiguration (wird von der Oberfläche geschrieben)",
             "# Zugangsdaten stehen in secrets.json bzw. Umgebungsvariablen, nicht hier.", ""]
    for section in DEFAULT_CONFIG:
        lines.append(f"[{section}]")
        for k, v in cfg.get(section, {}).items():
            if k in ("api_key", "password", "max_ergebnisse_pro_suche"):
                continue
            key = k if re.fullmatch(r"[A-Za-z0-9_-]+", k) else json.dumps(k, ensure_ascii=False)
            lines.append(f"{key} = {_toml_value(v)}")
        lines.append("")
    with DATA_LOCK:
        Path(path).write_text("\n".join(lines), encoding="utf-8")


# ---------------------------------------------------------------- Logging, Dateien, Zähler

class DailyFileHandler(logging.Handler):
    """Schreibt nach logs/JJJJ-MM-TT.log – auch wenn das Programm über Mitternacht läuft."""

    def emit(self, record):
        try:
            LOG_DIR.mkdir(exist_ok=True)
            with open(LOG_DIR / f"{dt.date.today().isoformat()}.log", "a", encoding="utf-8") as f:
                f.write(self.format(record) + "\n")
        except OSError:
            pass


def setup_logging(verbose=False, console=True):
    if log.handlers:
        return
    fh = DailyFileHandler()
    fh.setFormatter(logging.Formatter("%(asctime)s  %(levelname)-7s %(message)s", "%Y-%m-%d %H:%M:%S"))
    fh.setLevel(logging.DEBUG)
    log.addHandler(fh)
    if console:
        ch = logging.StreamHandler(sys.stdout)
        ch.setFormatter(logging.Formatter("%(message)s"))
        ch.setLevel(logging.DEBUG if verbose else logging.INFO)
        log.addHandler(ch)
    log.setLevel(logging.DEBUG)


def read_csv(path):
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, delimiter=";"))


def write_csv(path, rows, fields):
    # Semikolon + BOM, damit deutsches Excel die Datei direkt richtig öffnet
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields, delimiter=";", extrasaction="ignore", restval="")
        w.writeheader()
        w.writerows(rows)
    for _ in range(6):
        try:
            tmp.replace(path)
            return
        except PermissionError:
            log.warning(f"{path.name} ist gesperrt (in Excel offen?) – bitte schließen, neuer Versuch in 5 s")
            time.sleep(5)
    raise PermissionError(f"Konnte {path.name} nicht schreiben. Neue Daten liegen in {tmp.name}")


def load_leads():
    with DATA_LOCK:
        return read_csv(LEADS_CSV)


def save_leads(leads):
    with DATA_LOCK:
        write_csv(LEADS_CSV, leads, LEAD_FIELDS)


def get_lead(pid):
    return next((l for l in load_leads() if l["place_id"] == pid), None)


def upsert_lead(lead):
    with DATA_LOCK:
        leads = read_csv(LEADS_CSV)
        for i, l in enumerate(leads):
            if l["place_id"] == lead["place_id"]:
                leads[i] = {**l, **lead}
                break
        else:
            leads.append(lead)
        write_csv(LEADS_CSV, leads, LEAD_FIELDS)


def update_lead(pid, **fields):
    with DATA_LOCK:
        leads = read_csv(LEADS_CSV)
        for l in leads:
            if l["place_id"] == pid:
                l.update({k: v for k, v in fields.items() if k in LEAD_FIELDS})
                write_csv(LEADS_CSV, leads, LEAD_FIELDS)
                return l
    return None


def load_contacted():
    with DATA_LOCK:
        return read_csv(CONTACTED_CSV)


def add_contacted(row):
    with DATA_LOCK:
        rows = read_csv(CONTACTED_CSV)
        rows.append(row)
        write_csv(CONTACTED_CSV, rows, CONTACTED_FIELDS)


def load_blocklist():
    if not BLOCKLIST.exists():
        return set()
    return {l.strip().lower() for l in BLOCKLIST.read_text(encoding="utf-8").splitlines()
            if l.strip() and not l.startswith("#")}


def add_to_blocklist(addr):
    with DATA_LOCK, open(BLOCKLIST, "a", encoding="utf-8") as f:
        f.write(addr.lower() + "\n")


def is_blocked(addr, blocked):
    addr = addr.lower()
    return addr in blocked or "@" + addr.split("@")[-1] in blocked


def count_usage(kind, n=1):
    with DATA_LOCK:
        try:
            usage = json.loads(USAGE_JSON.read_text(encoding="utf-8"))
        except (FileNotFoundError, ValueError):
            usage = {}
        month = usage.setdefault(dt.date.today().strftime("%Y-%m"), {})
        month[kind] = month.get(kind, 0) + n
        USAGE_JSON.write_text(json.dumps(usage, indent=2), encoding="utf-8")


def usage_this_month():
    try:
        usage = json.loads(USAGE_JSON.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        usage = {}
    return usage.get(dt.date.today().strftime("%Y-%m"), {})


def sent_today():
    today = dt.date.today().isoformat()
    return sum(1 for c in load_contacted() if c["datum"].startswith(today))


# ---------------------------------------------------------------- Google Maps

PLACES_URL = "https://places.googleapis.com/v1/places:searchText"
PLACES_FIELDS = ("places.id,places.displayName,places.formattedAddress,places.websiteUri,"
                 "places.nationalPhoneNumber,places.businessStatus,places.googleMapsUri,"
                 "places.primaryTypeDisplayName,nextPageToken")
LOCATE_FIELDS = "places.displayName,places.formattedAddress,places.location,places.viewport"


def _places_request(api_key, body, fields):
    r = requests.post(PLACES_URL, json=body, timeout=30,
                      headers={"X-Goog-Api-Key": api_key, "X-Goog-FieldMask": fields})
    count_usage("google")
    if r.status_code != 200:
        raise RuntimeError(f"Google Places API {r.status_code}: {r.text[:300]}")
    return r.json()


def search_places(api_key, query, limit=60, rect=None):
    """Bis zu 60 Treffer (Google-Maximum). Gibt (treffer, anzahl_anfragen) zurück."""
    results, token, pages = [], None, 0
    while len(results) < limit:
        check_stop()
        body = {"textQuery": query, "languageCode": "de", "regionCode": "DE", "pageSize": 20}
        if rect:
            body["locationRestriction"] = {"rectangle": rect}
        if token:
            body["pageToken"] = token
        data = _places_request(api_key, body, PLACES_FIELDS)
        pages += 1
        results += data.get("places", [])
        token = data.get("nextPageToken")
        if not token:
            break
        time.sleep(0.3)
    return results[:limit], pages


def locate(api_key, name):
    data = _places_request(api_key, {"textQuery": name, "languageCode": "de", "regionCode": "DE", "pageSize": 1},
                           LOCATE_FIELDS)
    if not data.get("places"):
        raise RuntimeError(f"Region „{name}“ wurde bei Google nicht gefunden")
    return data["places"][0]


def rect_for(place, radius_km):
    loc = place["location"]
    if not radius_km and place.get("viewport"):
        return place["viewport"]
    r = radius_km or 10
    dlat = r / 111.0
    dlng = r / (111.32 * math.cos(math.radians(loc["latitude"])))
    return {"low": {"latitude": loc["latitude"] - dlat, "longitude": loc["longitude"] - dlng},
            "high": {"latitude": loc["latitude"] + dlat, "longitude": loc["longitude"] + dlng}}


def rect_size_km(rect):
    lo, hi = rect["low"], rect["high"]
    h = (hi["latitude"] - lo["latitude"]) * 111.0
    w = (hi["longitude"] - lo["longitude"]) * 111.32 * math.cos(math.radians((hi["latitude"] + lo["latitude"]) / 2))
    return w, h


def split_rect(rect):
    lo, hi = rect["low"], rect["high"]
    mlat = (lo["latitude"] + hi["latitude"]) / 2
    mlng = (lo["longitude"] + hi["longitude"]) / 2
    return [{"low": {"latitude": a, "longitude": b}, "high": {"latitude": c, "longitude": d}}
            for a, c in ((lo["latitude"], mlat), (mlat, hi["latitude"]))
            for b, d in ((lo["longitude"], mlng), (mlng, hi["longitude"]))]


def search_area(api_key, term, rect, budget, found, depth=0):
    """Google liefert max. 60 Treffer pro Suche. Ist eine Kachel voll, wird sie geviertelt und neu gesucht."""
    if budget["left"] <= 0:
        budget["capped"] = True
        return
    places, pages = search_places(api_key, term, 60, rect)
    budget["left"] -= pages
    for p in places:
        found.setdefault(p["id"], p)
    if len(places) >= 60 and depth < 5:
        w, h = rect_size_km(rect)
        log.debug(f"    Kachel {w:.0f}×{h:.0f} km voll – wird aufgeteilt")
        for sub in split_rect(rect):
            search_area(api_key, term, sub, budget, found, depth + 1)


# ---------------------------------------------------------------- Website prüfen

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/129.0 Safari/537.36",
      "Accept-Language": "de-DE,de;q=0.9"}

META_REFRESH_RE = re.compile(r"""<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["']?\s*\d*\s*;?\s*url\s*=\s*([^"'>\s]+)""",
                             re.I)


def fetch(url, _hops=0):
    try:
        r = requests.get(url, headers=UA, timeout=15, allow_redirects=True)
    except requests.RequestException as e:
        log.debug(f"    fetch {url}: {type(e).__name__}")
        return None
    if r.status_code >= 400:
        return None
    if "charset" not in r.headers.get("Content-Type", "").lower():
        r.encoding = r.apparent_encoding
    # <meta http-equiv="refresh" content="0;url=cms/"> – Weiterleitungsseite, echtes Ziel laden
    m = META_REFRESH_RE.search(r.text[:3000])
    if m and _hops < 3:
        target = urljoin(r.url, htmllib.unescape(m.group(1)))
        if target != r.url:
            return fetch(target, _hops + 1) or r
    return r


OLD_TECH = {
    "Frames": r"<frameset",
    "Flash": r"\.swf\b|shockwave-flash",
    "<font>-Tags": r"<font\b",
    "jQuery 1.x": r"jquery[-.]?1\.\d|jquery/1\.\d",
    "<marquee>/<center>": r"<marquee|<center>",
    "Tabellen-Layout": r"<table[^>]+(?:bgcolor|background)=",
    "Homepage-Baukasten alt": r"FrontPage|NetObjects|Homepage-Baukasten|IONOS MyWebsite Creator 1",
}


def assess_website(url, cfg):
    """Gibt dict mit status, score, html, final_url zurück. Höherer Score = schlechtere Website."""
    s = cfg["suche"]
    if not url:
        return {"status": "keine Website", "score": 99, "html": "", "final_url": ""}

    p = urlparse(url if url.startswith("http") else "http://" + url)
    reasons, score = [], 0

    resp = fetch(p._replace(scheme="https").geturl())
    if resp is None:
        resp = fetch(p._replace(scheme="http").geturl())
        if resp is None:
            return {"status": "Website nicht erreichbar", "score": 3, "html": "", "final_url": ""}
        if not resp.url.startswith("https"):
            reasons.append("kein HTTPS")
            score += 2

    page = resp.text

    if not re.search(r"<meta[^>]+name\s*=\s*[\"']?viewport", page, re.I):
        reasons.append("nicht mobil optimiert")
        score += 2

    this_year = dt.date.today().year
    years = []
    for a, b in re.findall(r"(?:©|&copy;|copyright)\D{0,25}((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?",
                           page, re.I):
        years += [int(y) for y in (a, b) if y]
    if years and max(years) <= this_year - s["website_veraltet_ab_jahren"]:
        reasons.append(f"Copyright {max(years)}")
        score += 1

    lm = resp.headers.get("Last-Modified")
    if lm:
        try:
            if email.utils.parsedate_to_datetime(lm).year <= this_year - s["website_veraltet_ab_jahren"]:
                reasons.append(f"zuletzt geändert {lm[:16]}")
                score += 1
        except (TypeError, ValueError):
            pass

    old = [name for name, pat in OLD_TECH.items() if re.search(pat, page, re.I)]
    if old:
        reasons.append("veraltet: " + ", ".join(old))
        score += min(2, len(old))

    if resp.elapsed.total_seconds() > 5:
        reasons.append(f"langsam ({resp.elapsed.total_seconds():.0f}s)")
        score += 1

    return {"status": "; ".join(reasons) or "ok", "score": score, "html": page, "final_url": resp.url}


# ---------------------------------------------------------------- E-Mail + Name finden

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")
LINK_RE = re.compile(r"""<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>(.*?)</a>""", re.I | re.S)
JUNK_EMAIL = re.compile(r"\.(png|jpe?g|gif|svg|webp|css|js)$|example\.|beispiel|domain\.|sentry|wixpress|"
                        r"ihre-?mail|muster|@2x|noreply|no-reply|datenschutz@|^you@|^name@|^email@|company\.com|yourname|"
                        r"ihr-?name|vorname", re.I)
VALID_TLD = {"de", "com", "net", "org", "eu", "info", "biz", "at", "ch", "li", "it", "fr", "nl", "lu", "be", "dk",
             "pl", "cz", "online", "shop", "site", "website", "email", "gmbh", "berlin", "bayern", "swiss",
             "haus", "bau", "holz", "team", "work", "company", "business", "services", "studio", "design",
             "io", "co", "me", "app", "tv", "cc", "ag"}
PREFERRED_PREFIX = ("info", "kontakt", "mail", "office", "post", "buero", "büro", "anfrage", "service")
FREEMAIL = {"gmx.de", "gmx.net", "web.de", "t-online.de", "gmail.com", "googlemail.com", "yahoo.de",
            "yahoo.com", "outlook.de", "outlook.com", "hotmail.de", "hotmail.com", "freenet.de",
            "arcor.de", "online.de", "aol.com", "icloud.com", "posteo.de", "mail.de"}


def strip_tags(page):
    page = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", " ", page)
    page = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</li>|</h\d>|</tr>", "\n", page)
    return htmllib.unescape(re.sub(r"<[^>]+>", " ", page))


def cf_decode(hexstr):
    key = int(hexstr[:2], 16)
    return "".join(chr(int(hexstr[i:i + 2], 16) ^ key) for i in range(2, len(hexstr), 2))


def _deobfuscate(text):
    text = re.sub(r"\s*[\[\(\{]\s*(?:at|ät|@)\s*[\]\)\}]\s*", "@", text, flags=re.I)
    text = re.sub(r"\s*[\[\(\{]\s*(?:dot|punkt|\.)\s*[\]\)\}]\s*", ".", text, flags=re.I)
    return EMAIL_RE.findall(text)


def emails_in(page, site_host=""):
    text = htmllib.unescape(page)
    found = _deobfuscate(text)
    found += [cf_decode(h) for h in re.findall(r'data-cfemail="([0-9a-fA-F]+)"', page)]
    if site_host:
        # manche CMS verstecken die Adresse ROT13-kodiert (Bild-URL, data-value); nur eigene Domain zählen
        own = site_host.removeprefix("www.")
        found += [e for e in _deobfuscate(codecs.decode(unquote(text), "rot13")) if e.lower().endswith("@" + own)]
    found = [e.strip(".").lower() for e in found]
    return [e for e in found if not JUNK_EMAIL.search(e) and e.rsplit(".", 1)[-1] in VALID_TLD]


def subpages(page, base_url):
    host = urlparse(base_url).netloc.lower().removeprefix("www.")
    found = {}
    for href, label in LINK_RE.findall(page):
        key = (href + " " + strip_tags(label)).lower()
        for kind in ("impressum", "imprint", "kontakt", "contact"):
            if kind in key and kind not in found:
                url = urljoin(base_url, htmllib.unescape(href.strip()))
                if url.startswith("http") and urlparse(url).netloc.lower().removeprefix("www.") == host:
                    found[kind] = url
    for kind in ("impressum", "kontakt"):
        found.setdefault(kind, urljoin(base_url, "/" + kind))
    return found


NAME = r"([A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?)"


def extract_anrede(text, fallback):
    m = re.search(r"\b(Herr|Frau)n?[ \t]+(?:(?:Dr|Dipl|Prof|Ing)[\w.\-]*[ \t]+)*" + NAME + r"(?:[ \t]+" + NAME + r")?",
                  text)
    if m:
        return f"Hallo {m.group(1)} {m.group(3) or m.group(2)},"
    m = re.search(r"(Inhaberin|Geschäftsführerin|Inhaber|Geschäftsführer|Betriebsinhaber|Vertreten durch)"
                  r"\s*:?[ \t\n]*(?:Zimmermeister|Meister|Herrn?|Frau)?[ \t]*(?:(?:Dr|Dipl|Prof|Ing)[\w.\-]*[ \t]+)*"
                  + NAME + r"[ \t]+" + NAME, text)
    if m:
        if m.group(1) in ("Inhaberin", "Geschäftsführerin"):
            return f"Hallo Frau {m.group(3)},"
        return f"Guten Tag {m.group(2)} {m.group(3)},"
    return fallback


def pick_email(candidates, site_host):
    if not candidates:
        return ""
    site_host = site_host.removeprefix("www.")

    def rank(e):
        local, _, dom = e.partition("@")
        return (dom != site_host and not site_host.endswith("." + dom),  # eigene Domain zuerst
                dom not in FREEMAIL and dom != site_host,                 # fremde Firmen-Domains zuletzt
                not local.startswith(PREFERRED_PREFIX),
                len(e))
    return sorted(set(candidates), key=rank)[0]


def extract_contact(home_html, home_url, fallback_anrede):
    host = urlparse(home_url).netloc.lower()
    candidates = emails_in(home_html, host)
    impressum_text = ""
    for kind, url in subpages(home_html, home_url).items():
        r = fetch(url)
        if r is None:
            continue
        candidates += emails_in(r.text, host)
        if kind in ("impressum", "imprint") and not impressum_text:
            impressum_text = strip_tags(r.text)
    anrede = extract_anrede(impressum_text or strip_tags(home_html), fallback_anrede)
    return pick_email(candidates, host), anrede


# ---------------------------------------------------------------- E-Mail per Websuche (Brave Search API)

BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"
GENERIC_WORDS = {"zimmerei", "holzbau", "zimmer", "zimmermann", "zimmermeister", "zimmerarbeiten", "gmbh", "und",
                 "treppenbau", "schreinerei", "tischlerei", "fensterbau", "dachdeckerei", "dachdecker",
                 "bedachungen", "meisterbetrieb", "inhaber", "holzhaus", "holzhausbau", "servicedienste",
                 "service", "malerbetrieb", "maler", "elektro", "elektrotechnik", "sanitaer", "heizung",
                 "friseur", "salon", "restaurant", "gaststaette", "pizzeria", "landgasthof", "gasthaus", "hotel",
                 "metallbau", "schlosserei", "gartenbau", "landschaftsbau", "fliesen", "bauunternehmung",
                 "baugeschaeft", "partner", "gebr", "gebrueder", "sohn", "soehne", "herr", "frau", "firma"}

_brave_lock = threading.Lock()
_brave_last = [0.0]


def norm(text):
    text = text.lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        text = text.replace(a, b)
    return text


def mentions(text, key, ort, plz):
    t = norm(text)
    return key in t and ((plz and plz in t) or (ort and norm(ort) in t))


def brave_search(cfg, query):
    with _brave_lock:  # Brave erlaubt 1 Anfrage/Sekunde – gilt auch bei paralleler Prüfung
        pause = 1.1 - (time.time() - _brave_last[0])
        if pause > 0:
            time.sleep(pause)
        try:
            r = requests.get(BRAVE_URL, timeout=20,
                             params={"q": query, "country": "de", "search_lang": "de", "count": 10,
                                     "extra_snippets": "true"},
                             headers={"X-Subscription-Token": cfg["websuche"]["api_key"],
                                      "Accept": "application/json"})
        finally:
            _brave_last[0] = time.time()
    count_usage("brave")
    if r.status_code != 200:
        raise RuntimeError(f"Brave Search API {r.status_code}: {r.text[:200]}")
    return r.json().get("web", {}).get("results", [])


def branch_stems(cfg, branche):
    """'Zimmerei' + Suchbegriffe 'Holzbau' -> {'zimme', 'holzb'}"""
    terms = [branche] + list(cfg["suchbegriffe"].get(branche, []))
    return {norm(w)[:5] for t in terms for w in re.findall(r"[a-zäöüß]{4,}", t.lower())}


def find_email_web(lead, cfg):
    """Sucht '<Firma> <Ort> E-Mail' im Web. Gibt (email, quelle, sicher) zurück.
    sicher = Nachname UND Branche stecken in der Adresse (z.B. zimmerei.baeuerle@…)."""
    generic = GENERIC_WORDS | {norm(w) for w in re.findall(r"[a-zäöüß]+", lead.get("branche", "").lower())}
    words = [norm(w) for w in re.findall(r"[a-zäöüß]{4,}", lead["firma"].lower()) if norm(w) not in generic]
    if not words:
        return "", "", False
    key = words[-1]  # meist der Familienname: "Zimmerei Holzbau Steffen Burkhardt" -> burkhardt
    plz = (re.search(r"\b(\d{5})\b", lead["adresse"]) or [None, ""])[1]
    ort = lead["ort"]

    results = brave_search(cfg, f'{lead["firma"]} {ort} E-Mail')

    cands = []
    for res in results:
        snippet = strip_tags(" ".join([res.get("title", ""), res.get("description", "")]
                                      + res.get("extra_snippets", [])))
        if mentions(snippet, key, ort, plz):
            cands += [(e, res["url"]) for e in emails_in(snippet)]
    if not cands:
        opened = 0
        for res in results:
            if opened >= cfg["websuche"].get("max_seiten_oeffnen", 3):
                break
            if key not in norm(res.get("title", "") + res["url"]):
                continue
            opened += 1
            page = fetch(res["url"])
            if page is not None and mentions(strip_tags(page.text), key, ort, plz):
                cands += [(e, res["url"]) for e in emails_in(page.text)]

    # Adressen des Verzeichnisses selbst (kundenservice@11880.com …) raus, außer sie enthalten den Namen
    cands = [(e, u) for e, u in cands
             if key in norm(e) or e.split("@")[1].removeprefix("www.") not in urlparse(u).netloc]
    if not cands:
        return "", "", False
    stems = branch_stems(cfg, lead.get("branche", ""))
    for e, u in cands:
        if key in norm(e) and any(st in norm(e) for st in stems):
            return e, u, True
    for e, u in cands:
        if key in norm(e):
            return e, u, False
    return cands[0][0], cands[0][1], False


def websuche_enabled(cfg):
    return bool(cfg["websuche"].get("aktiv", True) and cfg["websuche"]["api_key"])


def apply_web_email(lead, cfg):
    try:
        addr, quelle, sicher = find_email_web(lead, cfg)
    except (requests.RequestException, RuntimeError) as e:
        log.warning(f"    Websuche fehlgeschlagen: {e}")
        return
    if addr:
        lead["email"], lead["email_quelle"] = addr, quelle
        lead["status"] = "bereit" if sicher else "pruefen"


def find_contact(lead, cfg, force=False):
    """Website bewerten + E-Mail suchen (Website, sonst Websuche). Ändert lead direkt.
    force=True: auch bei guter Website die E-Mail suchen (manuell aus der Oberfläche)."""
    fallback = cfg["versand"]["anrede_fallback"]
    a = assess_website(lead["website"], cfg)
    lead["website_status"], lead["score"] = a["status"], a["score"]
    if a["score"] < cfg["suche"]["min_schlecht_score"] and not force:
        lead["status"] = "website_ok"
        return lead
    if a["html"]:
        lead["email"], lead["anrede"] = extract_contact(a["html"], a["final_url"], fallback)
        lead["email_quelle"] = "Website" if lead["email"] else ""
    lead["status"] = "bereit" if lead["email"] else "keine_email"
    if not lead["email"] and websuche_enabled(cfg):
        apply_web_email(lead, cfg)
    return lead


# ---------------------------------------------------------------- Suchen

UNTERKUNFT = {"Beherbergung", "Apartmenthaus", "Hotel", "Ferienwohnung"}


def is_foreign(lead, cfg):
    """Andere Branche? Steht die Branche selbst im Namen ("Zimmerei Hofmann"), zählt der Name mehr als
    Googles oft schiefe Kategorie – außer bei Unterkünften ("Alte Zimmerei – Doppelzimmer")."""
    s = cfg["suche"]
    kat, name = lead.get("kategorie", ""), norm(lead["firma"])
    terms = [lead.get("branche", "")] + list(cfg["suchbegriffe"].get(lead.get("branche", ""), []))
    if any(norm(t) in name for t in terms if t) and kat not in UNTERKUNFT:
        return False
    if kat and kat in s["ausschliessen_kategorien"]:
        return True
    return any(norm(w) in name for w in s["ausschliessen_woerter"] if w)


def _lead_from_place(pl, branche, region, cfg):
    adresse = pl.get("formattedAddress", "")
    return {"place_id": pl["id"], "firma": pl.get("displayName", {}).get("text", "?"), "branche": branche,
            "region": region, "ort": (re.search(r"\d{5}\s+([^,]+)", adresse) or [None, region])[1],
            "adresse": adresse, "telefon": pl.get("nationalPhoneNumber", ""), "website": pl.get("websiteUri", ""),
            "email": "", "anrede": cfg["versand"]["anrede_fallback"], "email_quelle": "", "notiz": "",
            "gefunden_am": dt.date.today().isoformat(), "maps_url": pl.get("googleMapsUri", ""),
            "kategorie": (pl.get("primaryTypeDisplayName") or {}).get("text", "")}


def _check_place(pl, branche, region, cfg):
    check_stop()
    lead = _lead_from_place(pl, branche, region, cfg)
    if is_foreign(lead, cfg):
        lead.update(status="fremd", website_status="", score="")
        return lead
    return find_contact(lead, cfg)


def process_places(cfg, places, branche, region):
    neu = 0
    with ThreadPoolExecutor(max_workers=max(1, int(cfg["suche"]["parallel"]))) as ex:
        futs = [ex.submit(_check_place, pl, branche, region, cfg) for pl in places]
        for i, f in enumerate(as_completed(futs), 1):
            try:
                lead = f.result()
            except Stopped:
                continue
            except Exception as e:
                log.warning(f"  Fehler bei einer Firma: {e}")
                continue
            upsert_lead(lead)
            if lead["status"] == "fremd":
                log.info(f"  [{i}/{len(places)}]  –  {lead['firma']}: andere Branche ({lead['kategorie']})")
            elif lead["status"] == "website_ok":
                log.info(f"  [{i}/{len(places)}]  –  {lead['firma']}: Website ok")
            else:
                neu += 1
                info = {"bereit": lead["email"], "pruefen": f"{lead['email']} (unsicher, bitte prüfen)",
                        "keine_email": "keine E-Mail – anrufen?"}[lead["status"]]
                log.info(f"  [{i}/{len(places)}]  +  {lead['firma']} ({lead['website_status']}) → {info}")
    check_stop()
    return neu


def run_suche(cfg, regionen=None, branchen=None, umkreis_km=None):
    key = cfg["google"]["api_key"]
    if not key:
        raise RuntimeError("Kein Google API-Key – bitte unter Einstellungen eintragen.")
    s = cfg["suche"]
    regionen = regionen or s["regionen"]
    branchen = branchen or s["branchen"]
    umkreis = s["umkreis_km"] if umkreis_km is None else umkreis_km

    known = {l["place_id"] for l in load_leads()} | {c.get("place_id", "") for c in load_contacted()}
    budget = {"left": int(s["max_google_anfragen_pro_suche"]), "capped": False}
    start_left, total_new = budget["left"], 0

    for region in regionen:
        check_stop()
        place = locate(key, region)
        budget["left"] -= 1
        rect = rect_for(place, umkreis)
        w, h = rect_size_km(rect)
        log.info(f"Region {place['displayName']['text']} – Suchgebiet ca. {w:.0f} × {h:.0f} km")
        for branche in branchen:
            found = {}
            for term in [branche] + list(cfg["suchbegriffe"].get(branche, [])):
                before = len(found)
                search_area(key, term, rect, budget, found)
                log.info(f"  Suchbegriff „{term}“: {len(found) - before} weitere Betriebe")
            neu = [p for pid, p in found.items()
                   if pid not in known and p.get("businessStatus", "OPERATIONAL") == "OPERATIONAL"]
            log.info(f"  {branche} rund um {region}: {len(found)} Betriebe, davon {len(neu)} neu – prüfe Websites …")
            known.update(p["id"] for p in neu)
            total_new += process_places(cfg, neu, branche, region)
    if budget["capped"]:
        log.warning("Das Limit an Google-Anfragen pro Suche wurde erreicht – das Gebiet ist evtl. nicht "
                    "vollständig durchsucht. Unter Einstellungen erhöhen und erneut suchen.")
    log.info(f"Fertig: {total_new} neue Leads. Google-Anfragen dieser Suche: {start_left - budget['left']}")
    return total_new


def run_nachpruefen(cfg):
    """Leads ohne E-Mail erneut prüfen (keine Google-Kosten)."""
    todo = [l for l in load_leads() if l["status"] == "keine_email" and l["website"]]
    log.info(f"Prüfe {len(todo)} Leads mit Website erneut …")
    found = 0
    for lead in todo:
        check_stop()
        find_contact(lead, cfg)
        upsert_lead(lead)
        found += bool(lead["email"])
        log.info(f"  {lead['firma']}: {lead['website_status']} → {lead['email'] or lead['status']}")
    log.info(f"Fertig: {found} Leads haben jetzt eine E-Mail.")


def run_websuche(cfg):
    if not cfg["websuche"]["api_key"]:
        raise RuntimeError("Kein Brave API-Key – bitte unter Einstellungen eintragen.")
    todo = [l for l in load_leads() if l["status"] == "keine_email"]
    log.info(f"Websuche für {len(todo)} Leads ohne E-Mail …")
    for lead in todo:
        check_stop()
        apply_web_email(lead, cfg)
        upsert_lead(lead)
        tag = {"bereit": "+", "pruefen": "?"}.get(lead["status"], "–")
        log.info(f"  {tag}  {lead['firma']} ({lead['ort']}): {lead['email'] or 'nichts gefunden'}")
    n = {k: sum(l["status"] == k for l in todo) for k in ("bereit", "pruefen")}
    log.info(f"Fertig: {n['bereit']} sicher, {n['pruefen']} unsicher (Status „prüfen“).")


# ---------------------------------------------------------------- Vorlagen + Versand

def slug(text):
    return re.sub(r"[^a-z0-9]+", "_", norm(text)).strip("_") or "standard"


def template_name(branche, ohne_website):
    names = []
    if ohne_website:
        names += [f"{slug(branche)}_ohne_website", "standard_ohne_website"]
    names += [slug(branche), "standard"]
    for n in names:
        if (VORLAGEN_DIR / f"{n}.txt").exists():
            return n
    raise FileNotFoundError("Keine Vorlage gefunden (vorlagen/standard.txt fehlt)")


def list_templates():
    return sorted(p.stem for p in VORLAGEN_DIR.glob("*.txt"))


def read_template(name):
    return (VORLAGEN_DIR / f"{name}.txt").read_text(encoding="utf-8-sig")


def write_template(name, text):
    if not re.fullmatch(r"[a-z0-9_]+", name):
        raise ValueError("Name nur aus Kleinbuchstaben, Ziffern und _")
    (VORLAGEN_DIR / f"{name}.txt").write_text(text.replace("\r\n", "\n"), encoding="utf-8")


def render(template, lead):
    values = {k: lead.get(k, "") for k in LEAD_FIELDS}
    return re.sub(r"\{(\w+)\}", lambda m: str(values.get(m.group(1), m.group(0))), template)


def render_mail(cfg, lead):
    name = template_name(lead["branche"], lead["website_status"] == "keine Website")
    text = read_template(name)
    subject = cfg["versand"]["betreff"]
    if text.lower().startswith("betreff:"):
        first, _, text = text.partition("\n")
        subject = first.split(":", 1)[1].strip()
    return render(subject, lead), render(text.strip("\n") + "\n", lead), name


def build_message(cfg, to, subject, body):
    v = cfg["versand"]
    msg = EmailMessage()
    msg["From"] = email.utils.formataddr((v["absender_name"], v["absender_email"]))
    msg["To"] = to
    msg["Subject"] = subject
    msg["Date"] = email.utils.formatdate(localtime=True)
    msg["Message-ID"] = email.utils.make_msgid(domain=v["absender_email"].split("@")[1])
    msg["List-Unsubscribe"] = f"<mailto:{v['absender_email']}?subject=Abmelden>"
    msg.set_content(body)
    return msg


def smtp_send(cfg, msg):
    c = cfg["smtp"]
    with smtplib.SMTP(c["host"], int(c["port"]), timeout=30) as s:
        s.starttls(context=TLS)
        s.login(c["user"], c["password"])
        s.send_message(msg)


def imap_login(cfg):
    c = cfg["imap"]
    conn = imaplib.IMAP4_SSL(c["host"], int(c["port"]), ssl_context=TLS)
    conn.login(cfg["smtp"]["user"], cfg["smtp"]["password"])
    return conn


def store_in_sent(cfg, msg):
    try:
        conn = imap_login(cfg)
        conn.append(f'"{cfg["imap"]["gesendet_ordner"]}"', "\\Seen",
                    imaplib.Time2Internaldate(time.time()), msg.as_bytes())
        conn.logout()
    except Exception as e:
        log.warning(f"    Konnte Mail nicht in „{cfg['imap']['gesendet_ordner']}“ ablegen: {e}")


def run_senden(cfg, live=True, anzahl=None):
    v = cfg["versand"]
    if live and not cfg["smtp"]["password"]:
        raise RuntimeError("Kein IONOS-Passwort – bitte unter Einstellungen eintragen.")

    limit = int(v["max_mails_pro_tag"]) - sent_today()
    if anzahl:
        limit = min(limit, int(anzahl))
    if limit <= 0:
        log.info(f"Tageslimit erreicht ({v['max_mails_pro_tag']} pro Tag). Morgen weiter.")
        return 0

    blocked = load_blocklist() | {c["email"].lower() for c in load_contacted()}
    todo = [l["place_id"] for l in load_leads() if l["status"] == "bereit"]
    log.info(("LIVE-VERSAND" if live else "VORSCHAU") + f": bis zu {limit} Mails, {len(todo)} Leads bereit")

    done, previews = 0, []
    for pid in todo:
        if done >= limit:
            break
        check_stop()
        lead = get_lead(pid)
        if not lead or lead["status"] != "bereit":  # inzwischen in der Oberfläche geändert
            continue
        addr = lead["email"].strip().lower()
        if is_blocked(addr, blocked):
            update_lead(pid, status="übersprungen")
            log.info(f"  übersprungen (schon kontaktiert/Blocklist): {lead['firma']} <{addr}>")
            continue

        subject, body, _ = render_mail(cfg, lead)
        if not live:
            previews.append(f"An: {lead['firma']} <{addr}>\nBetreff: {subject}\n\n{body}\n{'=' * 70}\n")
            log.info(f"  [Vorschau] {lead['firma']} <{addr}>")
            done += 1
            continue

        msg = build_message(cfg, addr, subject, body)
        try:
            smtp_send(cfg, msg)
        except smtplib.SMTPAuthenticationError as e:
            log.error(f"IONOS-Login fehlgeschlagen ({e}). Passwort unter Einstellungen prüfen. Abbruch.")
            break
        except (smtplib.SMTPRecipientsRefused, smtplib.SMTPDataError) as e:
            update_lead(pid, status="fehler", notiz=f"Versandfehler: {e}"[:200])
            log.error(f"  FEHLER {lead['firma']} <{addr}>: {e}")
            continue
        except (smtplib.SMTPException, OSError) as e:
            log.error(f"  Verbindungsfehler bei {addr}: {e}. Abbruch – später erneut versuchen.")
            break

        add_contacted({**lead, "datum": dt.datetime.now().strftime("%Y-%m-%d %H:%M"),
                       "email": addr, "geantwortet": "", "antwort_datum": ""})
        update_lead(pid, status="gesendet")
        blocked.add(addr)
        done += 1
        log.info(f"  GESENDET {done}/{limit}: {lead['firma']} <{addr}>")

        if cfg["imap"]["im_gesendet_ablegen"]:
            store_in_sent(cfg, msg)

        if done < limit and any(l["status"] == "bereit" for l in load_leads()):
            pause = random.randint(int(v["pause_min_sekunden"]), int(v["pause_max_sekunden"]))
            log.info(f"    nächste Mail in {pause} s …")
            wait(pause)

    if previews:
        path = LOG_DIR / f"vorschau_{dt.date.today().isoformat()}.txt"
        path.write_text("\n".join(previews), encoding="utf-8")
        log.info(f"Vorschau aller Mails: {path}")
    log.info(f"{'Gesendet' if live else 'Würde senden'}: {done}")
    return done


# ---------------------------------------------------------------- Antworten

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
OPTOUT_RE = re.compile(r"abmelden|abbestellen|kein interesse|keine weiteren|nicht mehr (?:an)?schreiben|"
                       r"unsubscribe|bitte entfernen|löschen sie", re.I)


def imap_date(d):
    return f"{d.day:02d}-{MONTHS[d.month - 1]}-{d.year}"


def fetch_message(conn, msg_id):
    _, data = conn.fetch(msg_id, "(BODY.PEEK[])")
    return email.message_from_bytes(data[0][1], policy=email.policy.default)


def plain_text(msg):
    part = msg.get_body(preferencelist=("plain", "html"))
    try:
        return part.get_content() if part else ""
    except (LookupError, UnicodeDecodeError):
        return ""


def run_antworten(cfg):
    if not cfg["smtp"]["password"]:
        raise RuntimeError("Kein IONOS-Passwort – bitte unter Einstellungen eintragen.")
    offen = [c for c in load_contacted() if not c.get("geantwortet")]
    if not offen:
        log.info("Keine offenen Kontakte.")
        return
    log.info(f"Prüfe Postfach für {len(offen)} offene Kontakte …")

    conn = imap_login(cfg)
    conn.select("INBOX", readonly=True)
    updates = {}

    for c in offen:
        check_stop()
        since = imap_date(dt.date.fromisoformat(c["datum"][:10]))
        dom = c["email"].split("@")[1]
        # Antworten können auch von einer anderen Adresse derselben Firma kommen
        who = c["email"] if dom in FREEMAIL else "@" + dom
        _, data = conn.search(None, "FROM", f'"{who}"', "SINCE", since)
        ids = data[0].split()
        if not ids:
            continue
        msg = fetch_message(conn, ids[-1])
        text = (msg.get("Subject", "") or "") + "\n" + plain_text(msg)[:3000]
        status = "abgemeldet" if OPTOUT_RE.search(text) else "ja"
        try:
            when = email.utils.parsedate_to_datetime(msg["Date"]).strftime("%Y-%m-%d %H:%M")
        except (TypeError, ValueError):
            when = dt.date.today().isoformat()
        updates[c["email"]] = (status, when)
        if status == "abgemeldet":
            add_to_blocklist(c["email"])
        log.info(f"  ANTWORT ({status}): {c['firma']} <{c['email']}> – {msg.get('Subject', '')}")

    # Unzustellbare Mails (Bounces)
    earliest = min(dt.date.fromisoformat(c["datum"][:10]) for c in offen)
    for sender in ("MAILER-DAEMON", "postmaster"):
        _, data = conn.search(None, "FROM", f'"{sender}"', "SINCE", imap_date(earliest))
        for mid in data[0].split():
            _, raw = conn.fetch(mid, "(BODY.PEEK[])")
            raw = raw[0][1].lower()
            for c in offen:
                if c["email"] not in updates and c["email"].encode() in raw:
                    updates[c["email"]] = ("unzustellbar", dt.date.today().isoformat())
                    add_to_blocklist(c["email"])
                    log.info(f"  UNZUSTELLBAR: {c['firma']} <{c['email']}>")
    conn.logout()

    with DATA_LOCK:
        rows = read_csv(CONTACTED_CSV)
        for r in rows:
            if not r.get("geantwortet") and r["email"] in updates:
                r["geantwortet"], r["antwort_datum"] = updates[r["email"]]
        write_csv(CONTACTED_CSV, rows, CONTACTED_FIELDS)
    log.info(f"{len(updates)} neue Rückmeldungen.")


# ---------------------------------------------------------------- Kommandozeile

def cmd_status(cfg):
    leads, contacted = load_leads(), load_contacted()
    by_status = {}
    for l in leads:
        by_status[l["status"]] = by_status.get(l["status"], 0) + 1
    print(f"Leads gesamt: {len(leads)}")
    for k, n in sorted(by_status.items(), key=lambda x: -x[1]):
        print(f"  {k:<14} {n}")
    print(f"Angeschrieben gesamt: {len(contacted)}  (heute {sent_today()}/{cfg['versand']['max_mails_pro_tag']})")
    for k in ("ja", "abgemeldet", "unzustellbar"):
        print(f"  Antwort {k:<13} {sum(c.get('geantwortet') == k for c in contacted)}")


def cmd_ordner(cfg):
    conn = imap_login(cfg)
    for line in conn.list()[1]:
        print(line.decode(errors="replace"))
    conn.logout()


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Dulidan Studios Akquise-Tool")
    ap.add_argument("-v", "--verbose", action="store_true")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("suchen")
    p.add_argument("--region", action="append")
    p.add_argument("--branche", action="append")
    p.add_argument("--umkreis", type=int)
    p = sub.add_parser("senden")
    p.add_argument("--live", action="store_true")
    p.add_argument("--anzahl", type=int)
    for name in ("nachpruefen", "websuche", "antworten", "status", "ordner"):
        sub.add_parser(name)
    args = ap.parse_args()

    setup_logging(args.verbose)
    cfg = load_config()
    try:
        if args.cmd == "suchen":
            run_suche(cfg, args.region, args.branche, args.umkreis)
        elif args.cmd == "senden":
            run_senden(cfg, args.live, args.anzahl)
        else:
            {"nachpruefen": run_nachpruefen, "websuche": run_websuche, "antworten": run_antworten,
             "status": cmd_status, "ordner": cmd_ordner}[args.cmd](cfg)
    except RuntimeError as e:
        sys.exit(str(e))


if __name__ == "__main__":
    main()

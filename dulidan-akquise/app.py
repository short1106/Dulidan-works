#!/usr/bin/env python3
"""Dulidan Studios – Akquise-Oberfläche. Start: start.bat doppelklicken oder `python app.py`."""
import datetime as dt
import logging
import sys
import threading
import time
import traceback
import webbrowser

from flask import Flask, jsonify, request, send_from_directory

import akquise as core

PORT = 8765
app = Flask(__name__, static_folder=str(core.BASE / "ui"), static_url_path="")
logging.getLogger("werkzeug").setLevel(logging.ERROR)

JOB = {"name": None, "running": False, "log": [], "started": None, "finished": None}
JOB_LOCK = threading.Lock()
JOB_TITLES = {"suchen": "Suche", "websuche": "E-Mail-Websuche", "nachpruefen": "Websites erneut prüfen",
              "senden": "Versand", "antworten": "Antworten prüfen"}


class UiLogHandler(logging.Handler):
    def emit(self, record):
        JOB["log"].append({"t": time.strftime("%H:%M:%S"), "lvl": record.levelname, "msg": record.getMessage()})
        if len(JOB["log"]) > 3000:
            del JOB["log"][:1000]


core.setup_logging(console=True)
_ui_handler = UiLogHandler()
_ui_handler.setLevel(logging.INFO)
core.log.addHandler(_ui_handler)


def start_job(name, fn, *args):
    with JOB_LOCK:
        if JOB["running"]:
            return False
        JOB.update(name=name, running=True, log=[], started=time.time(), finished=None)
    core.STOP.clear()

    def run():
        try:
            fn(core.load_config(), *args)
        except core.Stopped:
            core.log.warning("Abgebrochen.")
        except Exception as e:
            core.log.error(f"Fehler: {e}")
            core.log.debug(traceback.format_exc())
        finally:
            JOB["running"], JOB["finished"] = False, time.time()

    threading.Thread(target=run, daemon=True).start()
    return True


def err(msg, code=400):
    return jsonify({"error": msg}), code


# ---------------------------------------------------------------- Seiten + Übersicht

@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/overview")
def overview():
    cfg = core.load_config()
    leads, contacted = core.load_leads(), core.load_contacted()
    by_status = {}
    for l in leads:
        by_status[l["status"]] = by_status.get(l["status"], 0) + 1
    replies = {k: sum(c.get("geantwortet") == k for c in contacted) for k in ("ja", "abgemeldet", "unzustellbar")}
    return jsonify({
        "leads_total": len(leads), "by_status": by_status, "contacted_total": len(contacted),
        "sent_today": core.sent_today(), "limit": cfg["versand"]["max_mails_pro_tag"], "replies": replies,
        "usage": core.usage_this_month(),
        "keys": {"google": bool(cfg["google"]["api_key"]), "brave": bool(cfg["websuche"]["api_key"]),
                 "ionos": bool(cfg["smtp"]["password"])},
        "recent": sorted(contacted, key=lambda c: c["datum"], reverse=True)[:6],
    })


# ---------------------------------------------------------------- Leads

@app.get("/api/leads")
def leads():
    return jsonify(core.load_leads())


@app.patch("/api/leads/<pid>")
def patch_lead(pid):
    data = request.get_json(force=True)
    allowed = {k: str(v).strip() for k, v in data.items() if k in ("status", "email", "anrede", "notiz", "branche")}
    if "email" in allowed:
        allowed["email"] = allowed["email"].lower()
        if allowed["email"] and not core.EMAIL_RE.fullmatch(allowed["email"]):
            return err("Das sieht nicht nach einer gültigen E-Mail-Adresse aus.")
    lead = core.update_lead(pid, **allowed)
    return jsonify(lead) if lead else err("Lead nicht gefunden", 404)


@app.post("/api/leads/bulk")
def bulk_leads():
    data = request.get_json(force=True)
    ids, status = set(data.get("ids", [])), data.get("status")
    if status not in ("bereit", "nein", "keine_email", "pruefen", "fremd"):
        return err("Ungültiger Status")
    with core.DATA_LOCK:
        rows = core.load_leads()
        n = 0
        for l in rows:
            if l["place_id"] in ids and not (status == "bereit" and not l["email"]):
                l["status"] = status
                n += 1
        core.save_leads(rows)
    return jsonify({"changed": n})


@app.post("/api/leads/<pid>/kontakt_suchen")
def lead_find_contact(pid):
    lead = core.get_lead(pid)
    if not lead:
        return err("Lead nicht gefunden", 404)
    if lead["status"] == "gesendet":
        return err("Diese Firma wurde schon angeschrieben.")
    cfg = core.load_config()
    old_email = lead["email"]
    core.find_contact(lead, cfg, force=True)
    if not lead["email"] and old_email:
        lead["email"], lead["status"] = old_email, "bereit"
    core.upsert_lead(lead)
    return jsonify(lead)


@app.get("/api/leads/<pid>/vorschau")
def lead_preview(pid):
    lead = core.get_lead(pid)
    if not lead:
        return err("Lead nicht gefunden", 404)
    subject, body, name = core.render_mail(core.load_config(), lead)
    return jsonify({"to": lead["email"], "subject": subject, "body": body, "vorlage": name})


@app.get("/api/vorschau_bereit")
def preview_ready():
    cfg = core.load_config()
    n = int(request.args.get("n", 20))
    out = []
    for lead in [l for l in core.load_leads() if l["status"] == "bereit"][:n]:
        subject, body, name = core.render_mail(cfg, lead)
        out.append({"firma": lead["firma"], "to": lead["email"], "subject": subject, "body": body,
                    "vorlage": name, "place_id": lead["place_id"]})
    return jsonify(out)


@app.get("/api/contacted")
def contacted():
    return jsonify(sorted(core.load_contacted(), key=lambda c: c["datum"], reverse=True))


# ---------------------------------------------------------------- Vorlagen

@app.get("/api/vorlagen")
def vorlagen():
    return jsonify([{"name": n, "text": core.read_template(n)} for n in core.list_templates()])


@app.post("/api/vorlagen")
def save_vorlage():
    data = request.get_json(force=True)
    try:
        core.write_template(data.get("name", ""), data.get("text", ""))
    except ValueError as e:
        return err(str(e))
    return jsonify({"ok": True})


@app.get("/api/vorlage_fuer")
def vorlage_fuer():
    branche = request.args.get("branche", "")
    return jsonify({"mit_website": core.template_name(branche, False),
                    "ohne_website": core.template_name(branche, True)})


# ---------------------------------------------------------------- Einstellungen

def _coerce(default, value):
    if isinstance(default, bool):
        return bool(value)
    if isinstance(default, int):
        return int(float(value))
    if isinstance(default, list):
        if isinstance(value, str):
            value = value.split(",")
        return [str(x).strip() for x in value if str(x).strip()]
    return str(value)


@app.get("/api/config")
def get_config():
    cfg = core.load_config()
    keys = {"google": bool(cfg["google"].pop("api_key")), "brave": bool(cfg["websuche"].pop("api_key")),
            "ionos": bool(cfg["smtp"].pop("password"))}
    cfg.pop("vorlagen", None)
    return jsonify({"config": cfg, "keys": keys})


@app.post("/api/config")
def post_config():
    data = request.get_json(force=True)
    cfg = core.load_config()
    for section, values in (data.get("config") or {}).items():
        if section == "suchbegriffe":
            cfg["suchbegriffe"] = {str(k).strip(): _coerce([], v) for k, v in values.items() if str(k).strip()}
            continue
        if section not in core.DEFAULT_CONFIG:
            continue
        for k, v in values.items():
            if k in core.DEFAULT_CONFIG[section]:
                try:
                    cfg[section][k] = _coerce(core.DEFAULT_CONFIG[section][k], v)
                except (TypeError, ValueError):
                    return err(f"Ungültiger Wert für {k}")
    core.save_config(cfg)
    secrets = data.get("secrets") or {}
    core.save_secrets({k: str(secrets.get(k, "")).strip()
                       for k in ("google_api_key", "brave_api_key", "ionos_password")})
    return jsonify({"ok": True})


@app.post("/api/test_ionos")
def test_ionos():
    cfg = core.load_config()
    try:
        conn = core.imap_login(cfg)
        conn.logout()
    except Exception as e:
        return err(f"Login fehlgeschlagen: {e}")
    return jsonify({"ok": True})


# ---------------------------------------------------------------- Hintergrund-Aufgaben

@app.post("/api/jobs/<name>")
def jobs(name):
    data = request.get_json(silent=True) or {}
    if name == "stop":
        core.STOP.set()
        return jsonify({"ok": True})
    if name == "suchen":
        cfg = core.load_config()
        regionen = _coerce([], data.get("regionen", [])) or cfg["suche"]["regionen"]
        branchen = _coerce([], data.get("branchen", [])) or cfg["suche"]["branchen"]
        umkreis = int(data.get("umkreis_km", cfg["suche"]["umkreis_km"]) or 0)
        cfg["suche"].update(regionen=regionen, branchen=branchen, umkreis_km=umkreis)
        if "suchbegriffe" in data:
            cfg["suchbegriffe"] = {k: _coerce([], v) for k, v in data["suchbegriffe"].items()}
        core.save_config(cfg)
        ok = start_job(name, core.run_suche, regionen, branchen, umkreis)
    elif name == "senden":
        if not data.get("live"):
            return err("live fehlt")
        ok = start_job(name, core.run_senden, True, data.get("anzahl"))
    elif name in ("websuche", "nachpruefen", "antworten"):
        ok = start_job(name, {"websuche": core.run_websuche, "nachpruefen": core.run_nachpruefen,
                              "antworten": core.run_antworten}[name])
    else:
        return err("Unbekannte Aufgabe", 404)
    if not ok:
        return err(f"Es läuft gerade schon: {JOB_TITLES.get(JOB['name'], JOB['name'])}", 409)
    return jsonify({"ok": True})


@app.get("/api/job")
def job():
    since = int(request.args.get("since", 0))
    return jsonify({"name": JOB["name"], "title": JOB_TITLES.get(JOB["name"], ""), "running": JOB["running"],
                    "started": JOB["started"], "finished": JOB["finished"],
                    "log": JOB["log"][since:], "total": len(JOB["log"])})


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    url = f"http://127.0.0.1:{PORT}"
    print(f"\n  Dulidan Akquise läuft auf {url}\n  Dieses Fenster offen lassen – schließen beendet das Tool.\n")
    if "--no-browser" not in sys.argv:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    app.run(host="127.0.0.1", port=PORT, threaded=True)

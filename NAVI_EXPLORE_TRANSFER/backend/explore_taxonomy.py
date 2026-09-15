"""Explore — progressive hockey-world taxonomy (data-driven & extensible).

Each node answers ONE question: "Where do you want to go next?".  Different
countries can have DIFFERENT trees — we never force Canada's structure onto
Sweden.  The UI is a single generic renderer; scale comes from data, not from
new screens, so 500 more leagues (or a whole youth/local provider) plug in by
adding nodes here — no Explore redesign required.

Only the 5 leagues we've actually mapped into Ticker are AVAILABLE.  Everything
else is honest COMING SOON — we never fabricate leagues, teams or geography.

Node shape returned to the client:
  { path, kind: "chooser"|"leagues", title, subtitle, flag, note?, choices: [ ... ] }
Choice shape:
  { label, sub, status: "available"|"coming_soon", kind: "node"|"league"|"soon",
    path?  (kind=node),  code?  (kind=league),  icon? }
"""

# Leagues we have wired end-to-end (code -> real Ticker League Hub).
AVAILABLE = {"nhl", "whl", "ohl", "qmjhl", "ncaa"}

# Display identity for every league we NAME in the static tree (available or not).
LG: dict[str, tuple[str, str]] = {
    "nhl":     ("NHL", "National Hockey League"),
    "whl":     ("WHL", "Western Hockey League"),
    "ohl":     ("OHL", "Ontario Hockey League"),
    "qmjhl":   ("QMJHL", "Québec Maritimes Junior"),
    "ncaa":    ("NCAA", "College Hockey"),
    # Canada — coming soon
    "pwhl":    ("PWHL", "Professional Women's Hockey League"),
    "usports": ("U SPORTS", "Canadian university hockey"),
    "bchl":    ("BCHL", "British Columbia (Junior A)"),
    "ajhl":    ("AJHL", "Alberta Junior"),
    "ojhl":    ("OJHL", "Ontario Junior"),
    "mjhl":    ("MJHL", "Manitoba Junior"),
    "sjhl":    ("SJHL", "Saskatchewan Junior"),
    # Sweden — coming soon
    "shl":         ("SHL", "Svenska hockeyligan (top tier)"),
    "allsvenskan": ("HockeyAllsvenskan", "Second tier"),
    "hockeyettan": ("HockeyEttan", "Third tier"),
    "j20":         ("J20 Nationell", "Junior elite"),
    "sdhl":        ("SDHL", "Swedish Women's Hockey League"),
}


def _lg_choice(key: str) -> dict:
    name, full = LG.get(key, (key.upper(), ""))
    avail = key in AVAILABLE
    return {
        "label": name, "sub": full,
        "status": "available" if avail else "coming_soon",
        "kind": "league" if avail else "soon",
        "code": key if avail else None,
    }


def _node(label: str, path: str, sub: str = "", icon: str = "chevron-forward",
          status: str = "available") -> dict:
    return {"label": label, "sub": sub, "kind": "node", "path": path,
            "icon": icon, "status": status}


def _chooser(path, title, subtitle, flag, choices, note=None):
    return {"path": path, "kind": "chooser", "title": title, "subtitle": subtitle,
            "flag": flag, "note": note, "choices": choices}


def _leagues(path, title, subtitle, flag, keys, note=None):
    return {"path": path, "kind": "leagues", "title": title, "subtitle": subtitle,
            "flag": flag, "note": note, "choices": [_lg_choice(k) for k in keys]}


# --------------------------------------------------------------------------- CANADA
# Complex hockey nation: three honest ways to narrow — Level / Region / League.
_CA = "🇨🇦"
_CANADA_PROVINCES = [
    ("British Columbia", "BC"), ("Alberta", "AB"), ("Saskatchewan", "SK"),
    ("Manitoba", "MB"), ("Ontario", "ON"), ("Québec", "QC"), ("Atlantic", "AT"),
]

STATIC: dict[str, dict] = {
    "country:Canada": _chooser(
        "country:Canada", "Canada", "How do you want to explore Canadian hockey?", _CA,
        [
            _node("By Level", "country:Canada/level", "Pro · Junior · University · Youth", "layers-outline"),
            _node("By Region", "country:Canada/region", "Province · city · association", "map-outline"),
            _node("By League", "country:Canada/league", "Browse every Canadian competition", "list-outline"),
        ]),

    "country:Canada/level": _chooser(
        "country:Canada/level", "Canada · By Level", "Pick a level of the game", _CA,
        [
            _node("Pro", "country:Canada/level/pro", "NHL · PWHL", "trophy-outline"),
            _node("Major Junior", "country:Canada/level/major-junior", "CHL — WHL · OHL · QMJHL", "flame-outline"),
            _node("Junior A", "country:Canada/level/junior-a", "BCHL · AJHL and more", "snow-outline", "coming_soon"),
            _node("University", "country:Canada/level/university", "U SPORTS", "school-outline", "coming_soon"),
            _node("Youth & Local", "country:Canada/level/youth", "Minor · AAA · associations", "people-outline", "coming_soon"),
        ]),
    "country:Canada/level/pro": _leagues(
        "country:Canada/level/pro", "Canada · Pro", "The professional game", _CA,
        ["nhl", "pwhl"]),
    "country:Canada/level/major-junior": _leagues(
        "country:Canada/level/major-junior", "Major Junior", "Canadian Hockey League (CHL)", _CA,
        ["whl", "ohl", "qmjhl"]),
    "country:Canada/level/junior-a": _leagues(
        "country:Canada/level/junior-a", "Junior A", "Provincial Junior A leagues", _CA,
        ["bchl", "ajhl", "ojhl", "mjhl", "sjhl"],
        note="Junior A coverage is being wired from our provider — coming to Ticker soon."),
    "country:Canada/level/university": _leagues(
        "country:Canada/level/university", "University", "Canadian university hockey", _CA,
        ["usports"],
        note="U SPORTS coverage is coming to Ticker soon."),
    "country:Canada/level/youth": _chooser(
        "country:Canada/level/youth", "Youth & Local", "Geography-first — coming soon", _CA,
        [_node("Browse by region", "country:Canada/region", "Province → city → association", "map-outline")],
        note="Minor, AAA/AA/A, girls hockey, academies and tournaments connect by WHERE you are. "
             "We're wiring real local data before we open this world."),

    "country:Canada/region": _chooser(
        "country:Canada/region", "Canada · By Region", "Where in Canada?", _CA,
        [_node(name, f"country:Canada/region/{slug}", "", "location-outline", "coming_soon")
         for name, slug in _CANADA_PROVINCES]),
    # Province leaves are honest coming-soon (youth/local geography not wired yet).
    **{
        f"country:Canada/region/{slug}": _chooser(
            f"country:Canada/region/{slug}", name, "Local hockey · coming soon", _CA, [],
            note=f"{name} associations, minor hockey and local teams will appear here once "
                 "our youth & local data is connected.")
        for name, slug in _CANADA_PROVINCES
    },

    # --------------------------------------------------------------------- SWEDEN
    # Deliberately a DIFFERENT tree — tier-first + women's, no province layer.
    "country:Sweden": _chooser(
        "country:Sweden", "Sweden", "Swedish hockey is organised by tier.", "🇸🇪",
        [
            _node("Men's Tiers", "country:Sweden/tier", "SHL · Allsvenskan · Ettan", "layers-outline", "coming_soon"),
            _node("Women's Hockey", "country:Sweden/women", "SDHL", "female-outline", "coming_soon"),
            _node("By League", "country:Sweden/league", "Browse every Swedish competition", "list-outline"),
        ]),
    "country:Sweden/tier": _leagues(
        "country:Sweden/tier", "Sweden · Men's Tiers", "Top flight to third tier", "🇸🇪",
        ["shl", "allsvenskan", "hockeyettan", "j20"],
        note="Swedish tier coverage is confirmed by our provider — coming to Ticker soon."),
    "country:Sweden/women": _leagues(
        "country:Sweden/women", "Sweden · Women", "Women's elite hockey", "🇸🇪",
        ["sdhl"],
        note="SDHL coverage is coming to Ticker soon."),
}


def resolve(path: str, by_country: dict[str, list], flag_for) -> dict | None:
    """Return the node for a path.  Static nodes win; otherwise fall back to a
    provider-truth 'browse leagues' node for a country (so EVERY country entrance
    works and richer countries simply override with a chooser tree)."""
    if path in STATIC:
        return STATIC[path]

    if path.startswith("country:"):
        rest = path[len("country:"):]
        if rest.endswith("/league"):
            country = rest[: -len("/league")]
        elif "/" not in rest:
            country = rest
        else:
            return None
        return _browse(path, country, by_country, flag_for)
    return None


def _browse(path: str, country: str, by_country: dict[str, list], flag_for) -> dict:
    rows = list(by_country.get(country, []))
    rows.sort(key=lambda r: (r["status"] != "available", (r["name"] or "").lower()))
    choices = []
    for r in rows:
        avail = r["status"] == "available"
        choices.append({
            "label": r["name"], "sub": r["country"],
            "status": r["status"], "kind": "league" if avail else "soon",
            "code": r["code"],
        })
    n_avail = sum(1 for r in rows if r["status"] == "available")
    sub = (f"{len(rows)} competitions · {n_avail} live in Ticker" if rows
           else "No verified competitions here yet")
    return {
        "path": path, "kind": "leagues", "title": country, "subtitle": sub,
        "flag": flag_for(country),
        "note": None if rows else "No verified competitions from our provider here yet — coming soon.",
        "choices": choices,
    }

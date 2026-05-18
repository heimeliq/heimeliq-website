# heimeliq-website

Statische Website für [heimeliQ](https://heimeliq.de) – Open-Source-Möbel aus regionalen Naturmaterialien (Massivholz, Stahl, Sperrholz). Jedes Möbelstück lebt in einem eigenen Git-Repo und wird beim Build automatisch eingelesen.

---

## Technologie-Stack

| Schicht | Technologie |
|---|---|
| Site-Generator | [Astro 5](https://astro.build) – statisches HTML, kein JS-Framework |
| Sprache | TypeScript (strict) |
| Möbel-Metadaten | [OKH v2.4](https://github.com/iop-alliance/OpenKnowHow) (`okh.toml`) + heimeliQ-Extension (`heimeliq.toml`) |
| TOML-Parser | smol-toml |
| Schema-Validierung | AJV 8 (`src/lib/schemas/okh.schema.json`, `heimeliq.schema.json`) |
| Git-Sync | simple-git (clone/pull beim Serverstart) |
| Markdown | marked (README.md jedes Möbels → HTML) |
| CSS | Plain CSS, keine Frameworks |

---

## Verzeichnisstruktur

```
heimeliq-website/
├── content/
│   ├── pages/               # Reserviert für zukünftige CMS-Inhalte
│   └── series/              # Reihen-Metadaten (je eine pro Möbel-Reihe)
│       ├── massiq/
│       │   ├── series.json  # Name, Tagline, Akzentfarbe
│       │   └── story.md     # Redaktioneller Text zur Reihe
│       ├── workaholiq/
│       └── keiliq/
├── docker/                  # Docker-Konfiguration (Phase D, noch ausstehend)
├── furniture-repos.json     # Liste aller eingebundenen Möbel-Repos ← hier neue Möbel eintragen
├── public/
│   └── moebel/              # Medien + CAD-Dateien (auto-generiert, gitignored)
├── src/
│   ├── layouts/
│   │   └── BaseLayout.astro # Navigation, Footer, globale Meta-Tags
│   ├── lib/
│   │   ├── furniture-sync.ts       # Git-Sync, TOML-Parsing, Schema-Validierung
│   │   ├── furniture-data.ts       # Caching-Schicht + Media-Kopierfunktion
│   │   ├── furniture-integration.ts # Astro-Integration (läuft beim Serverstart)
│   │   ├── furniture-page.ts       # Aufbereitung der Daten für die Detailseite
│   │   ├── series.ts               # Reihen-Daten aus content/series/ lesen
│   │   └── schemas/
│   │       ├── okh.schema.json
│   │       └── heimeliq.schema.json
│   ├── pages/
│   │   ├── index.astro             # Startseite
│   │   ├── katalog.astro           # Alle Möbel, filterbar nach Reihe
│   │   ├── moebel/[slug].astro     # Detailseite je Möbelstück
│   │   ├── reihen/[series].astro   # Reihen-Übersichtsseite
│   │   ├── ueber.astro
│   │   ├── werkstatt.astro
│   │   ├── kontakt.astro
│   │   ├── impressum.astro
│   │   └── datenschutz.astro
│   └── styles/
│       └── global.css
└── .furniture-cache/        # Geklonte Möbel-Repos (auto-generiert, gitignored)
```

---

## Voraussetzungen

- Node.js ≥ 22
- Git (muss im PATH sein, wird für den Repo-Sync benötigt)

```bash
node --version   # v22.x.x
git --version
```

---

## Entwicklung starten

```bash
npm install
npm run dev
```

Der Dev-Server läuft auf `http://localhost:4321`. Beim Start werden automatisch alle Möbel-Repos aus `furniture-repos.json` geklont/aktualisiert und deren Mediendateien nach `public/moebel/` kopiert.

### Build für Produktion

```bash
npm run build    # TypeScript-Check + statisches Build nach dist/
npm run preview  # Build lokal vorschauen
```

### Nur den Repo-Sync manuell ausführen

```bash
npm run sync
```

Nützlich um zu prüfen, ob alle Repos erreichbar sind und die TOML-Dateien valide sind, ohne den Dev-Server zu starten.

---

## Neues Möbel-Repo hinzufügen

1. **Eintrag in `furniture-repos.json` ergänzen:**

```json
{
  "repos": [
    {
      "url": "https://github.com/heimeliq/massiq-sideboard-001",
      "version": "main",
      "published": true
    },
    {
      "url": "https://github.com/heimeliq/mein-neues-moebel",
      "version": "1.2.0",
      "published": false
    }
  ]
}
```

| Feld | Bedeutung |
|---|---|
| `url` | HTTPS-URL des Git-Repos (oder `file://`-Pfad für lokale Repos) |
| `version` | `"main"` für den aktuellen Hauptbranch oder eine Versionsnummer (z. B. `"1.2.0"`) – wird dann als Tag `v1.2.0` ausgecheckt |
| `published` | `true` → erscheint auf der Website; `false` → wird geklont und validiert, aber nicht angezeigt |

2. **Dev-Server neu starten** (oder `npm run sync` ausführen) – der Repo-Sync läuft automatisch.

### Anforderungen an das Möbel-Repo

Das Repo muss dem [heimeliQ-Template](../heimeliq-furniture-template) entsprechen. Pflichtdateien:

- `okh.toml` – OKH-Manifest (Name, Lizenz, Maße, Stückliste, …)
- `heimeliq.toml` – heimeliQ-Extension (Reihe, Slug, Status, externe Teile, …)
- `README.md` – Dokumentation, wird auf der Detailseite als HTML gerendert

Optionale Verzeichnisse, die automatisch nach `public/moebel/<slug>/` kopiert werden:

- `media/` – Bilder (`media/hero.jpg` als Hauptbild, `media/gallery/` für Galerie)
- `cad/` – CAD-Dateien für Downloads (STEP, STL, …)

---

## Reihen verwalten

Die drei Möbel-Reihen sind fest in `content/series/` definiert:

```
content/series/
├── massiq/      – Massivmöbel aus regionalen Hölzern
├── workaholiq/  – Werkstattmöbel
└── keiliq/      – French-Cleat- und Keilsysteme
```

Jede Reihe besteht aus zwei Dateien:

**`series.json`** – Metadaten:
```json
{
  "id": "massiq",
  "name": "MassiQ",
  "tagline": "Massivmöbel aus regionalen Hölzern",
  "color_accent": "#FIXME"
}
```

**`story.md`** – Redaktioneller Fließtext, der auf der Reihen-Seite (`/reihen/massiq`) angezeigt wird.

---

## Statische Seiten bearbeiten

Die einfachen Inhaltsseiten liegen direkt als Astro-Dateien in `src/pages/`:

| Datei | URL |
|---|---|
| `src/pages/ueber.astro` | `/ueber` |
| `src/pages/werkstatt.astro` | `/werkstatt` |
| `src/pages/kontakt.astro` | `/kontakt` |
| `src/pages/impressum.astro` | `/impressum` |
| `src/pages/datenschutz.astro` | `/datenschutz` |

Der HTML-Inhalt steht direkt in der jeweiligen `.astro`-Datei, eingerahmt von `<BaseLayout>`. Alle diese Seiten enthalten aktuell `FIXME`-Platzhalter, die vor dem Go-Live zu befüllen sind.

Navigation und Footer sind in `src/layouts/BaseLayout.astro` definiert.

---

## Wie der Sync funktioniert

```
npm run dev / npm run build
        │
        ▼
astro:config:setup (furniture-integration.ts)
        │
        ├─ Liest furniture-repos.json
        ├─ Klont neue Repos nach .furniture-cache/<name>/
        ├─ Pullt vorhandene Repos (git fetch + pull)
        ├─ Validiert okh.toml + heimeliq.toml gegen JSON-Schemas
        └─ Kopiert media/ + cad/ nach public/moebel/<slug>/
                │
                ▼
        Astro baut Seiten
        getStaticPaths() in [slug].astro liest die geklonten Daten
        und erzeugt eine statische Seite pro Möbelstück
```

Bei `published: false` wird das Repo trotzdem geklont und validiert, aber `getPublishedFurniture()` filtert es heraus – es erscheint weder im Katalog noch als eigene Seite.

---

## Lizenz

Quellcode der Website: MIT  
Möbel-Dokumentation: [CERN-OHL-S-2.0](https://ohwr.org/cern_ohl_s_v2.txt)

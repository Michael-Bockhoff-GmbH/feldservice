# IT Support mit Außendienst

Frappe-App für ERPNext v15/v16, entstanden aus dem Zusammenlegen der beiden
vormals eigenständigen Apps **`site_visit`** und **`zeit_projekt`** in eine
gemeinsame App (`fieldservice`). Drei Funktionen:

1. **Site Visit** – ein Techniker dokumentiert einen Kundeneinsatz vor Ort
   (Zeitraum inkl. Pausen, Fotos, Kundenunterschrift) und bekommt beim Buchen
   automatisch ein abrechenbares **Timesheet** erzeugt und verknüpft.
2. **Zeiterfassung als Einzelpositionen** – Knopf in der Ausgangsrechnung,
   der abrechenbare Zeiten (u. a. aus den oben erzeugten Timesheets) als
   eigene Rechnungspositionen importiert.
3. **Projekt aus Auftrag** – Haken im Auftrag, der beim Bestätigen
   automatisch ein Projekt anlegt und verknüpft.

Ein **Auftrag** ist bei Site Visit Pflicht, da darüber abgerechnet wird –
gibt es noch keinen, lässt er sich direkt aus dem Site Visit heraus anlegen
(siehe "Auftrag" unten). Die beiden ursprünglichen Apps arbeiten lose über
Kern-Doctypes zusammen (Activity Type, Timesheet) – aus diesem
Zusammenspiel heraus kam der Wunsch, sie als eine App auszuliefern.

---

## Zusammenlegung: was sich geändert hat

`fieldservice` ist technisch weiterhin **zwei Frappe-Module** in einer App –
"Site Visit" und "Zeit Projekt" wurden unverändert aus den beiden
Ursprungs-Apps übernommen (gleicher Modulname, gleiche Doctypes, gleiche
Feldnamen). Nur die App drumherum (Name, `hooks.py`, `install.py`,
Übersichts-Kachel) ist jetzt eine gemeinsame. Wer eine der beiden alten Apps
(`site_visit`, `zeit_projekt` – siehe deren Repositories, jetzt archiviert)
bereits installiert hatte: dort erst `bench uninstall-app <alte-app>`, dann
`fieldservice` installieren, da beide Module sich nicht gleichzeitig zwei
Apps zuordnen lassen.

Alle Python-Pfade, die App-intern auf sich selbst verweisen (`doc_events`,
`before_request`, `override_doctype_dashboards`, aufgerufene
`frappe.call`-Methoden in den Formular-Skripten), wurden dabei von
`site_visit.*`/`zeit_projekt.*` auf `fieldservice.*` umgestellt – die
**Modulnamen** ("Site Visit", "Zeit Projekt") und alle **Doctype-/Feldnamen**
blieben unverändert.

---

## Aufbau

```
fieldservice/
├── pyproject.toml
├── license.txt
├── README.md
├── CLAUDE.md
└── fieldservice/
    ├── __init__.py           # Versionsnummer + pdf_on_submit-Chrome-Patch
    ├── hooks.py              # doctype_js + doc_events + Install-Hooks (beide Module)
    ├── install.py            # after_install/before_uninstall (beide Module)
    ├── modules.txt           # "Site Visit" und "Zeit Projekt"
    ├── patches.txt
    ├── public/
    │   ├── js/
    │   │   ├── site_visit.js      # Site Visit: Feld-Defaults, Timer, Neuer-Auftrag-Dialog
    │   │   ├── sales_order.js     # Zeit Projekt: Hinweise + Sprung zum Projekt nach dem Buchen
    │   │   └── sales_invoice.js   # Zeit Projekt: Import-Knopf und Positionslogik
    │   └── images/fieldservice-logo.svg
    ├── translations/
    │   └── de.csv               # Deutsche Übersetzungen fürs Modul "Site Visit" (siehe "Sprache")
    ├── workspace_sidebar/
    │   └── site_visits.json     # Eigene Sidebar (Site Visit + Timesheet, kein Home-Link)
    ├── site_visit/            # Modul "Site Visit"
    │   ├── doctype/
    │   │   ├── site_visit/          # Haupt-Doctype (submittable)
    │   │   ├── site_visit_photo/    # Kindtabelle für Fotos
    │   │   ├── site_visit_item/     # Kindtabelle für Zusatzartikel
    │   │   └── site_visit_break/    # Kindtabelle für Pausen (Timer)
    │   ├── print_format/
    │   │   └── site_visit_report/   # PDF-Vorlage
    │   ├── workspace/
    │   │   └── site_visits/         # Desk-Seite
    │   ├── site_visit.py            # before_submit/on_cancel/create_sales_order/...
    │   └── project_dashboard.py     # ergänzt "Site Visit" in den Projekt-Verknüpfungen
    └── zeit_projekt/           # Modul "Zeit Projekt"
        ├── doctype/
        │   └── zeit_projekt_einstellungen/
        └── sales_order.py            # Projektanlage in before_submit (serverseitig)
```

`install.py` legt außer den drei Custom Fields von "Zeit Projekt" **keine**
weiteren Custom Fields oder sonstigen Datensätze auf Kern-Doctypes an – der
einzige weitere Zweck ist der optionale Eintrag in `PDF on Submit Settings`
(siehe "Automatische PDF-Erzeugung" unten), und auch der nur, wenn
`pdf_on_submit` installiert ist. Alles andere gehört zu den Modulen "Site
Visit"/"Zeit Projekt" und wird von `uninstall-app` bereits vollständig
entfernt.

Die Formular-Skripte sind **Dateien**, keine Client-Script-Datensätze. Sie
verschwinden restlos mit der App und unterliegen nicht dem
Client-Script-Cache im Browser.

## Sprache

Die beiden Module sind historisch unterschiedlich aufgebaut, das ist nach
der Zusammenlegung bewusst so geblieben:

- **Site Visit**: auf Englisch geschrieben (Feldbezeichnungen, Meldungen,
  Druckvorlage), Übersetzung über `fieldservice/translations/de.csv` (Frappes
  normales Verfahren – der englische Text im Code/in der Doctype-JSON
  bleibt die Quelle, die CSV-Datei übersetzt für Nutzer mit Sprache
  "Deutsch"). Standardbegriffe, die bereits über Frappe/ERPNext selbst
  übersetzt sind (z. B. "Customer", "Employee", "Project", "Sales Order",
  "Timesheet"), sind bewusst **nicht** nochmal in `de.csv` enthalten.
- **Zeit Projekt**: Feldbezeichnungen und Meldungen stehen direkt auf
  Deutsch im Code/in der Doctype-JSON, ohne eigene Übersetzungsdatei.

Nach Änderungen an Texten im Site-Visit-Code: neue/geänderte Strings auch in
`de.csv` ergänzen, sonst bleiben sie auf Deutsch unübersetzt (Englisch als
Fallback). Bei Zeit-Projekt-Texten direkt im Code ändern.

---

## Vor der Installation anpassen

In `pyproject.toml` und `fieldservice/hooks.py` Name, E-Mail und Beschreibung
eintragen. Willst du die App anders nennen, muss der Name an vier Stellen
konsistent sein: Ordnername, Paketordner, `app_name` in `hooks.py` und
`name` in `pyproject.toml` – dazu alle `fieldservice.*`-Pfade in `hooks.py`
(`doc_events`, `before_request`, `override_doctype_dashboards`,
`add_to_apps_screen`, `after_install`/`before_uninstall`) sowie die
`frappe.call`-Methodenpfade in `public/js/site_visit.js` und
`public/js/sales_invoice.js`.

---

## Installation (eigener Bench)

```bash
cd ~/frappe-bench
bench get-app https://github.com/<dein-user>/fieldservice.git
bench --site <deine-site> install-app fieldservice
bench build --app fieldservice
bench --site <deine-site> clear-cache
```

## Installation (Frappe Cloud)

Eigene Apps brauchen dort ein Git-Repository und eine eigene Bench-Gruppe
(auf den kleinen Shared-Plänen nicht möglich).

1. Repository auf GitHub anlegen und den Inhalt dieses Ordners hochladen
2. In Frappe Cloud: Bench-Gruppe → *Apps* → *Add App* → *From GitHub*
3. Deploy anstoßen, danach die App auf der Site installieren

---

## Deinstallation

```bash
bench --site <deine-site> uninstall-app fieldservice --dry-run   # nur anzeigen
bench --site <deine-site> uninstall-app fieldservice
```

**Was dabei entfernt wird:**

- die Doctype "Site Visit" und ihre Kindtabellen ("Site Visit Photo",
  "Site Visit Item", "Site Visit Break")
- die Doctype "Zeit Projekt Einstellungen" und die drei Custom Fields von
  "Zeit Projekt" (`before_uninstall`)
- beide Module ("Site Visit", "Zeit Projekt") und alles, was daran hängt
- die Formular-Skripte, da sie reiner Code sind
- die Zeile `Site Visit` in `PDF on Submit Settings` (nur falls
  `pdf_on_submit` installiert ist – `before_uninstall` räumt sie mit auf)

**Was bewusst bestehen bleibt:**

- bereits gebuchte Site Visits inkl. Fotos und Unterschrift, bereits
  angelegte und gebuchte Timesheets, auch wenn das erzeugende Site Visit
  später storniert würde
- bereits fakturierte Timesheets – ein Site Visit mit fakturiertem
  Timesheet lässt sich nicht mehr stornieren (siehe `on_cancel` in
  `site_visit/site_visit.py`)
- bereits in Aufträge übernommene Zusatzartikel (die Auftragspositionen
  selbst gehören nicht zu dieser App)
- alle angelegten Projekte, alle geschriebenen Rechnungspositionen (auch in
  gebuchten Belegen), die Verknüpfungen zwischen Auftrag und Projekt

**Achtung:** Beim Löschen eines Custom Fields wird die Spalte aus der
Tabelle entfernt. Die Zuordnungen *Aktivitätsart → Dienstleistungsartikel*
sind danach weg. Frappe legt vor dem Deinstallieren automatisch ein Backup
an (außer mit `--no-backup`).

---

## Einrichtung

- Für jede genutzte **Activity Type** sollte ein sinnvoller Stundensatz
  hinterlegt sein, damit ein automatisch aus einem Site Visit erzeugtes
  Timesheet korrekt abgerechnet werden kann.
- Je Aktivitätsart einen **Dienstleistungsartikel** eintragen (für den
  Rechnungsimport), dafür einen **Verkaufspreis** in der
  Standard-Verkaufspreisliste hinterlegen.
- Prüfen, dass der Projekttyp **External** existiert (für die automatische
  Projektanlage aus dem Auftrag).

Unter **Zeit Projekt Einstellungen** (Suchleiste oder
`/app/zeit-projekt-einstellungen`) lässt sich das Verhalten des
Rechnungsimports umstellen:

**Erste Zeile der Positionsbeschreibung**

| Auswahl | Ergebnis in der Position |
|---|---|
| *Nur Datum und Uhrzeit* (Standard) | `05.05.2026 09:51-13:51 Uhr` – der Artikelname steht ohnehin schon in der Position |
| *Aktivitätsart voranstellen* | `Ausführung – 05.05.2026 09:51-13:51 Uhr` |
| *Bezeichnung für Rechnung, sonst Aktivitätsart* | nutzt das Feld `custom_rechnungstext` der Aktivitätsart, sonst deren Namen |

Die dritte Variante lohnt nur, wenn mehrere Aktivitätsarten auf denselben
Artikel zeigen – dann ist die Bezeichnung die einzige Unterscheidung auf der
Rechnung. In den ersten beiden Modi kann das Feld *Bezeichnung für Rechnung*
leer bleiben. Der Freitext aus der Zeitbuchung steht in allen drei Varianten
darunter.

**Liefertermin der Position:** Beginn (Standard) oder Ende der Zeitbuchung.
Relevant nur bei Buchungen über Mitternacht.

## Nach der Installation

Die App deaktiviert vorhandene Client Scripts mit den Namen
„Zeiterfassung als Einzelpositionen", „Auftrag: Projekt erstellen" und
„Auftrag: Kommission und Projekt", damit die Funktionen nicht doppelt
laufen. Löschen musst du sie selbst.

## Eigene App im Desk

Die App bringt ein eigenes Logo mit
(`public/images/fieldservice-logo.svg`) und registriert sich über
`add_to_apps_screen`/`app_logo_url` in `hooks.py` als eigene Kachel auf der
Apps-Übersicht (`/apps`), inklusive einer eigenen Workspace mit
Verknüpfungen zu "Site Visit" und "Timesheet".

## Auftrag

`sales_order` ist bei Site Visit Pflicht – jeder Einsatz muss einem Auftrag
zugeordnet sein, da darüber (und über das automatisch erzeugte Timesheet)
abgerechnet wird. Gibt es noch keinen passenden Auftrag, öffnet der Button
**"New Sales Order"** im Formular (sichtbar, solange kein Auftrag verknüpft
ist) einen Dialog: Kunde/Firma/Projekt kommen vom Site Visit, dazu lässt
sich die **Kundenreferenz** (Feld `po_no`, wie beim normalen Anlegen eines
Auftrags) eintragen. Der neue Auftrag entsteht als **Entwurf** – Buchen
bleibt Sache des Vertriebs, nicht des Technikers vor Ort – und übernimmt die
bereits eingetragenen Zusatzartikel (siehe unten) als Startpositionen; dafür
muss mindestens eine Zeile in "Additional Items" stehen, da ein Auftrag ohne
Position nicht anlegbar ist.

**Zusätzliche Artikel** (`extra_items`): vor Ort zusätzlich benötigtes
Material (z. B. ein USB-auf-LAN-Adapter), das noch nicht im Auftrag steht.
Beim Buchen des Site Visit werden neue (noch nicht übernommene) Zeilen
automatisch in die Positionen des verknüpften Auftrags aufgenommen – auch
wenn der Auftrag bereits gebucht ist (über
`erpnext.controllers.accounts_controller.update_child_qty_rate`, dieselbe
Funktion, die auch der "Update Items"-Dialog im Auftrag selbst verwendet;
bestehende Positionen, Steuern und Summen werden dabei korrekt neu
berechnet). Da Techniker i. d. R. keine eigenen Sales-Order-Rechte haben,
läuft das serverseitig kurzzeitig als Administrator – die eigentliche
Berechtigungsprüfung ist die auf den Site Visit selbst.

## Timer

"Start Timer"/"Stop Timer" im Site-Visit-Formular setzen nicht nur
`from_time`/`to_time`, sondern **speichern sofort** – genau wie ERPNexts
eigener Timesheet-Timer (`erpnext/public/js/projects/timer.js`, ruft nach
dem Setzen von `from_time` ebenfalls direkt `frm.save()` auf). Ohne das
sofortige Speichern ginge ein laufender Timer bei einem Reload oder
Schliessen der Seite verloren, weil ein neues, ungespeichertes Dokument nur
im Browser existiert.

Damit ein Entwurf mit nur laufendem Timer überhaupt speicherbar ist, sind
Kunde, Aktivitätsart, Auftrag und Endzeit **nicht auf Feldebene Pflicht** –
sie werden erst beim Buchen selbst geprüft (`before_submit` in
`site_visit/site_visit.py`), mit einer klaren Fehlermeldung, falls etwas
fehlt. `employee` ist ebenfalls nicht Pflicht (weder im Feld noch beim
Buchen) – bleibt es leer, entsteht das automatisch erzeugte Timesheet ohne
Mitarbeiter, genau wie bei einem von Hand angelegten Timesheet in ERPNext
selbst.

### Pausieren/Fortsetzen

Neben "Start Timer"/"Stop Timer" gibt es "Pause Timer"/"Resume Timer" — für
eine Kaffeepause vor Ort oder einen Notfall bei einem anderen Kunden, ohne
den Einsatz gleich ganz zu beenden. "Pause Timer" fragt per Dialog einen
**Grund** ab (`Break`, `Other Customer (Emergency)`, `Other`) und optional
eine **Notiz**, und legt damit eine Zeile in der Kindtabelle `breaks` an
(Doctype "Site Visit Break": `from_time`/`to_time`/`reason`/`note`) —
dieselbe Sofort-Speichern-Logik wie beim Start. "Resume Timer" schließt die
letzte offene Pausenzeile mit der aktuellen Zeit ab.

`from_time`/`to_time` am Site Visit selbst bleiben dabei unverändert der
durchgehende Gesamtrahmen des Einsatzes — die Pausen werden erst beim Buchen
herausgerechnet: `_get_work_segments()` in `site_visit/site_visit.py`
zerlegt den Zeitraum anhand der (dann alle geschlossenen) Pausen in einzelne
Arbeitsabschnitte und legt dafür je einen eigenen Timesheet-Eintrag an,
statt eines einzigen Blocks über die volle Dauer. So zählt die Pausenzeit
weder als Arbeitszeit, noch überschneidet sie sich mit einem
Timesheet-Eintrag, den derselbe Mitarbeiter währenddessen für einen anderen
Site Visit anlegt (z. B. den Notfall-Einsatz beim anderen Kunden).

"Stop Timer" funktioniert auch während einer laufenden Pause — eine noch
offene Pause wird dann auf denselben Zeitpunkt wie `to_time` geschlossen,
statt ein vorheriges "Resume Timer" zu erzwingen (falls der Einsatz z. B.
mitten in der Pause endgültig endet). Vor dem Buchen muss trotzdem jede
Pause geschlossen sein — sonst weist `before_submit` mit einer klaren
Fehlermeldung darauf hin.

## Automatische PDF-Erzeugung beim Buchen

Die App liefert ein eigenes, gestaltetes Print Format **"Site Visit Report"**
mit (Kopfbereich, Kundendaten, Fotogalerie, Pausenübersicht,
Unterschriftsblock) und setzt es als Standard-Druckformat für "Site Visit".
Das alleine erzeugt aber noch keine automatische PDF-Anlage beim Buchen –
dafür braucht es einen PDF-Automatisierungsmechanismus wie die App
[`pdf_on_submit`](https://github.com/alyf-de/erpnext_pdf-on-submit) (bewusst
keine harte Abhängigkeit, `fieldservice` funktioniert auch ohne).

Ist `pdf_on_submit` zum Zeitpunkt der Installation bereits vorhanden, trägt
`install.py` automatisch die Zeile `Site Visit` / `Site Visit Report` in
dessen **PDF on Submit Settings** ein – kein manueller Schritt nötig. Wird
`pdf_on_submit` erst später installiert, einmalig von Hand nachtragen (die
gleiche Zeile in *Enabled For*) oder `bench execute
fieldservice.install.after_install` erneut laufen lassen.

`hooks.py` patcht zusätzlich `pdf_on_submit.attach_pdf.get_pdf_data()`,
damit die automatische PDF-Erzeugung über `frappe.get_print(...,
pdf_generator="chrome")` läuft statt über deren eigenen, direkten
wkhtmltopdf-Aufruf – auf Servern, auf denen wkhtmltopdf grundsätzlich
fehlschlägt (siehe `force_chrome_pdf` in `site_visit/site_visit.py`), würde
die automatische PDF-Anlage sonst im Hintergrund lautlos scheitern. Der
Patch greift nur, wenn `pdf_on_submit` tatsächlich installiert ist
(`try`/`except ImportError`), und liegt in `fieldservice/__init__.py` (siehe
Kommentar dort für die Begründung).

Ohne `pdf_on_submit` (oder eine ähnliche App) bleibt das Print Format
manuell nutzbar (Drucken/PDF-Button im Formular), nur eben nicht
automatisch.

## Berechtigungen

**Site Visit:**

| Rolle | Lesen | Schreiben | Anlegen | Buchen | Stornieren |
|---|---|---|---|---|---|
| System Manager | ✓ | ✓ | ✓ | ✓ | ✓ |
| Projects Manager | ✓ | ✓ | ✓ | ✓ | ✓ |
| Employee | eigene | eigene | ✓ | eigene | – |
| Projects User | ✓ | – | – | – | – |
| Accounts User | ✓ | – | – | – | – |

Ein gebuchter, unterschriebener Einsatz gilt als Bestätigung gegenüber dem
Kunden – nur Projects Manager/System Manager können ihn stornieren, nicht
der Techniker selbst. Es gibt bewusst keine eigene, engere Techniker-Rolle
als Fixture (Rollen sind nicht modulgebunden und würden beim Deinstallieren
als Karteileiche zurückbleiben); wer den Zugriff über die Standardrolle
"Employee" hinaus einschränken will, legt manuell eine eigene Rolle an.

**Zeit Projekt Einstellungen:** System Manager (voller Zugriff), Accounts
User/Accounts Manager/Projects User (nur lesen).

---

## Erweiterungsideen

- **Externes USB/Bluetooth-Signaturpad** (z. B. Wacom STU) statt Finger/Stift
  auf dem Touch-Bildschirm für die Kundenunterschrift bei Site Visit. Das
  Feld `customer_signature` speichert am Ende nur ein Bild – ein
  Hardware-Pad müsste nur dasselbe Feld befüllen (über Hersteller-SDK/
  Treiber im Browser), kein Umbau des Datenmodells nötig.
- Automatisches Zusammenfassen mehrerer Site Visits desselben Mitarbeiters
  zu einem Timesheet pro Zeitraum, statt eines neuen Timesheets je Einsatz.
- Automatisches Zusammenfassen mehrerer Pausen desselben Grundes im
  Einsatzbericht (aktuell wird jede einzeln aufgeführt).
- GPS/Standort-Erfassung beim Anlegen eines Site Visit.
- Direkte Rechnungs-/Angebotserstellung aus dem Site Visit heraus – aktuell
  läuft die Rechnungsstellung über den separaten Zeiterfassungs-Import in
  der Ausgangsrechnung.
- Custom Fields, die du später über die Oberfläche anlegst, gehören nicht
  automatisch der App. Trage sie in `CUSTOM_FIELDS` in `install.py` nach,
  dann werden sie beim Deinstallieren mitentfernt.
- Für Property Setter (geänderte Feldeigenschaften am Standard) gilt
  dasselbe: entweder im `after_install` erzeugen oder als Fixture
  exportieren und dabei das passende Modul setzen.

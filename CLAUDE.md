# Projektkontext

App `fieldservice` ("IT Support mit Außendienst") für ERPNext v16, entwickelt
auf einem Server mit Frappe Manager (fm). Entstanden aus dem Zusammenlegen
der vormals eigenständigen Apps `site_visit` und `zeit_projekt` - siehe
README.md "Zusammenlegung: was sich geändert hat" für den Hintergrund.

Bench: `<BENCHNAME>` — Site: `<SITENAME>`
(beim ersten Start bitte ersetzen)

Zwei Module, drei Funktionen:
1. Modul "Site Visit": Kundeneinsätze vor Ort dokumentieren (Zeitraum inkl.
   Pausen, Fotos, Unterschrift) und beim Buchen automatisch ein
   abrechenbares Timesheet erzeugen.
2. Modul "Zeit Projekt": Knopf in der Ausgangsrechnung, der Zeiterfassungen
   als einzelne Rechnungspositionen importiert; Haken im Auftrag, der beim
   Bestätigen automatisch ein Projekt anlegt und verknüpft.

Details zu Funktionsweise, Feldern und Einstellungen stehen in `README.md`
— vor der ersten Änderung lesen.

## Umgebung

Dieses Verzeichnis ist gleichzeitig `/workspace/frappe-bench/apps/fieldservice`
im Container. Dateien werden direkt hier bearbeitet. Alles, was bench oder
Python im Frappe-Kontext braucht, läuft über:

- Shell-Befehl:  `fm shell <BENCHNAME> -c "<befehl>"`
- Python/Frappe: `fm shell <BENCHNAME> --bench-console -c "<python>"`

Frappe- und ERPNext-Quellcode zum Nachschlagen (nur lesen, nie ändern):
`../frappe/frappe/` und `../erpnext/erpnext/`

## Befehle

| Zweck | Befehl |
|---|---|
| Nach JS-Änderung | `fm shell <BENCHNAME> -c "bench build --app fieldservice"` |
| Nach hooks.py/Python-Änderung | `fm shell <BENCHNAME> -c "bench --site <SITENAME> clear-cache && bench restart"` |
| Nach DocType-Änderung | `fm shell <BENCHNAME> -c "bench --site <SITENAME> migrate"` |
| App installieren | `fm shell <BENCHNAME> -c "bench --site <SITENAME> install-app fieldservice"` |
| App entfernen | `fm shell <BENCHNAME> -c "bench --site <SITENAME> uninstall-app fieldservice --yes"` |
| Logs | `fm logs <BENCHNAME> --follow` |

## Regeln

- Niemals Dateien außerhalb dieses App-Verzeichnisses ändern. Standardcode
  von Frappe oder ERPNext wird nur gelesen, nie gepatcht.
- Keine Client Scripts, keine Custom Fields über die Oberfläche anlegen —
  alles gehört in die App (`install.py`, `public/js/`, DocType-JSON), damit
  `uninstall-app` sauber wieder alles entfernt.
- Beide Module ("Site Visit", "Zeit Projekt") bleiben unter ihrem
  bisherigen Namen bestehen — nicht zusammenlegen oder umbenennen, das wäre
  eine (weitere) datenrelevante Migration, kein reiner Code-Umbau.
- Alle App-internen Python-Pfade (in `hooks.py` und in `frappe.call`-Aufrufen
  aus `public/js/`) beginnen mit `fieldservice.` (Beispiel:
  `fieldservice.site_visit.site_visit.before_submit`), nicht mit dem alten
  `site_visit.`/`zeit_projekt.` — bei Copy-Paste aus alten Notizen oder den
  (archivierten) Vorgänger-Repos darauf achten.
- Vor jeder Behauptung über Frappe-/ERPNext-Verhalten: im Quellcode
  nachsehen, nicht raten.
- Änderungen an der Datenbank immer über bench/Frappe-API, nie mit direktem
  SQL.
- Nach jeder Änderung selbst verifizieren (siehe unten) und das Ergebnis
  zeigen, bevor der nächste Schritt beginnt.
- Deutsche Oberflächentexte; Code-, Feld- und Methodennamen englisch bzw.
  wie in der App bereits vorgegeben (Präfix `custom_` für Custom Fields).
  Modul "Site Visit" übersetzt über `translations/de.csv` (englische
  Quelltexte), Modul "Zeit Projekt" hat seine deutschen Texte direkt im
  Code/in der Doctype-JSON — siehe README.md "Sprache".
- Kleine, einzeln nachvollziehbare Änderungen statt großer Umbauten in einem
  Schritt. Nach jeder funktionierenden Änderung committen.

## Verifikation

```bash
# Sind beide Module installiert?
fm shell <BENCHNAME> -c "bench --site <SITENAME> list-apps"

# Sind die Zeit-Projekt-Felder da?
fm shell <BENCHNAME> --bench-console -c "print(frappe.get_all('Custom Field', filters={'module':'Zeit Projekt'}, pluck='name'))"

# Sind die Einstellungen erreichbar?
fm shell <BENCHNAME> --bench-console -c "print(frappe.get_doc('Zeit Projekt Einstellungen').as_dict())"

# Existiert die Site-Visit-Doctype samt Kindtabellen?
fm shell <BENCHNAME> --bench-console -c "print(frappe.get_meta('Site Visit').get_table_fields())"
```

Browserseitiges Verhalten (Timer-Knöpfe, Dialoge, Sprung auf den Reiter
Verknüpfungen) lässt sich nicht automatisiert prüfen — dafür eine kurze
Klickliste vorschlagen und das Ergebnis vom Nutzer zurückmelden lassen.

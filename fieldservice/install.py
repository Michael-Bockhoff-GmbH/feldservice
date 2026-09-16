import click
import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

# ---------------------------------------------------------------------------
# Zeit Projekt: Custom Fields
#
# "module" ist wichtig: Damit gehoeren die Felder der App und wuerden selbst
# dann beim Deinstallieren geloescht, wenn before_uninstall nicht liefe.
# ---------------------------------------------------------------------------
ZEIT_PROJEKT_MODULE = "Zeit Projekt"

CUSTOM_FIELDS = {
	"Activity Type": [
		{
			"fieldname": "custom_dienstleistungsartikel",
			"label": "Dienstleistungsartikel",
			"fieldtype": "Link",
			"options": "Item",
			"insert_after": "billing_rate",
			"description": "Artikel, der bei der Rechnungsstellung fuer diese Aktivitaetsart verwendet wird",
			"module": ZEIT_PROJEKT_MODULE,
		},
		{
			"fieldname": "custom_rechnungstext",
			"label": "Bezeichnung für Rechnung",
			"fieldtype": "Data",
			"insert_after": "custom_dienstleistungsartikel",
			"description": "Optional: Text, der in der Rechnungsposition statt der Aktivitaetsart erscheint",
			"module": ZEIT_PROJEKT_MODULE,
		},
	],
	"Sales Order": [
		{
			"fieldname": "custom_projekt_erstellen",
			"label": "Projekt für diesen Auftrag erstellen",
			"fieldtype": "Check",
			"insert_after": "customer_name",
			"description": "Das Projekt wird angelegt und verknuepft, sobald der Auftrag bestaetigt (gebucht) wird",
			"module": ZEIT_PROJEKT_MODULE,
		},
	],
	# Traegt den Auftrag mit an die einzelne Zeitblatt-Zeile, statt nur ans
	# Projekt (Kern-Feld "project") - noetig, damit sich Zeiten beim
	# Rechnungsimport nach Auftrag filtern lassen und die Rechnungsposition
	# den Auftrag verknuepfen kann, auch wenn ein Projekt mehrere Auftraege
	# hat. Wird von site_visit/site_visit.py beim Anlegen des Timesheets
	# gesetzt (siehe _get_work_segments/before_submit dort) und von
	# zeit_projekt/timesheet_import.py gelesen.
	"Timesheet Detail": [
		{
			"fieldname": "custom_sales_order",
			"label": "Sales Order",
			"fieldtype": "Link",
			"options": "Sales Order",
			"insert_after": "project",
			"module": ZEIT_PROJEKT_MODULE,
		},
	],
}

# Client Scripts aus der manuellen Einrichtung. Werden bei der Installation
# deaktiviert, damit die Funktionen nicht doppelt laufen (zwei Knoepfe).
ALTE_CLIENT_SCRIPTS = [
	"Zeiterfassung als Einzelpositionen",
	"Auftrag: Projekt erstellen",
	"Auftrag: Kommission und Projekt",
]

# ---------------------------------------------------------------------------
# Site Visit: optionale Kopplung an pdf_on_submit
# ---------------------------------------------------------------------------
SITE_VISIT_DOCTYPE = "Site Visit"
SITE_VISIT_PRINT_FORMAT = "Site Visit Report"


def after_install():
	create_custom_fields(CUSTOM_FIELDS, ignore_validate=True)
	_deaktiviere_alte_client_scripts()
	click.secho("Zeit & Projekt: Felder angelegt.", fg="green")

	_pdf_on_submit_enable()


def before_uninstall():
	# Kein frappe.db.commit() hier: bench haengt diesen Hook in seine eigene
	# Transaktion um `uninstall-app` ein. Ein eigener commit() wuerde die
	# Loeschung sofort fest schreiben - auch bei `--dry-run`, das sich sonst
	# auf ein Rollback am Ende verlaesst (beobachtet am 12.09.2026: drei
	# Felder blieben nach einem Dry-Run tatsaechlich geloescht).
	geloescht = 0
	for doctype, felder in CUSTOM_FIELDS.items():
		for feld in felder:
			name = f"{doctype}-{feld['fieldname']}"
			if frappe.db.exists("Custom Field", name):
				frappe.delete_doc("Custom Field", name, ignore_missing=True, force=True)
				geloescht += 1

	click.secho(
		f"Zeit & Projekt: {geloescht} Felder entfernt. "
		"Hinweis: Die darin gepflegten Werte (z. B. die Artikelzuordnung je "
		"Aktivitaetsart) sind damit geloescht. Bereits angelegte Projekte und "
		"gebuchte Rechnungen bleiben unveraendert bestehen.",
		fg="yellow",
	)

	_pdf_on_submit_disable()


def _deaktiviere_alte_client_scripts():
	for name in ALTE_CLIENT_SCRIPTS:
		if frappe.db.exists("Client Script", name):
			frappe.db.set_value("Client Script", name, "enabled", 0)
			click.secho(
				f"Zeit & Projekt: Client Script '{name}' deaktiviert "
				"(Funktion kommt jetzt aus der App). Loeschen kannst du es selbst.",
				fg="yellow",
			)


def _pdf_on_submit_enable():
	"""Traegt Site Visit automatisch in PDF on Submit Settings ein, damit
	beim Buchen automatisch ein PDF am Einsatz haengt - nur falls die
	optionale App pdf_on_submit ueberhaupt installiert ist (siehe
	README.md "Automatische PDF-Erzeugung")."""
	if "pdf_on_submit" not in frappe.get_installed_apps():
		return

	settings = frappe.get_single("PDF on Submit Settings")
	if any(row.document_type == SITE_VISIT_DOCTYPE for row in settings.enabled_for):
		return

	settings.append("enabled_for", {"document_type": SITE_VISIT_DOCTYPE, "print_format": SITE_VISIT_PRINT_FORMAT})
	settings.save(ignore_permissions=True)
	click.secho(
		f"Site Visit: in PDF on Submit Settings eingetragen "
		f"({SITE_VISIT_DOCTYPE} / {SITE_VISIT_PRINT_FORMAT}).",
		fg="green",
	)


def _pdf_on_submit_disable():
	if "pdf_on_submit" not in frappe.get_installed_apps():
		return
	if not frappe.db.exists("DocType", "PDF on Submit Settings"):
		return

	settings = frappe.get_single("PDF on Submit Settings")
	remaining = [row for row in settings.enabled_for if row.document_type != SITE_VISIT_DOCTYPE]
	if len(remaining) == len(settings.enabled_for):
		return

	settings.enabled_for = []
	for row in remaining:
		settings.append("enabled_for", row)
	settings.save(ignore_permissions=True)
	click.secho("Site Visit: Eintrag in PDF on Submit Settings entfernt.", fg="yellow")

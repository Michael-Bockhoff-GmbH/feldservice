"""Fern-Unterschrift fuer als "Remote Visit" markierte Site Visits: statt der
Unterschrift auf dem Geraet des Technikers bekommt der Kunde einen Link per
E-Mail, unter dem er - ohne eigenen Login - selbst unterschreiben kann.

Sicherheit ueber ein zufaelliges, langes Token (secrets.token_urlsafe),
das nur per E-Mail beim Kunden landet, nicht im Site Visit selbst sichtbar
ist (Feld remote_signature_token ist hidden) und nach 30 Tagen ablaeuft.
Kein separates Once-Only-Invalidieren des Tokens noetig: ist die
Unterschrift schon gesetzt, lehnt submit_remote_signature weitere Versuche
ab, das Token bleibt aber technisch bis zum Ablauf gueltig (z. B. falls der
Kunde die Seite neu laedt, bevor er absendet).

Das Signieren selbst bucht das Site Visit NICHT - das bleibt Sache des
Technikers (siehe README "Fernarbeit"). Es setzt nur customer_signature/
signee_name, exakt wie eine Unterschrift direkt im Formular.
"""

import secrets

import frappe
from frappe import _
from frappe.utils import add_to_date, now_datetime

TOKEN_VALID_DAYS = 30


@frappe.whitelist()
def send_signing_link(site_visit):
	"""Fuer den "Send Signing Link"-Knopf im Formular. Erzeugt (bzw.
	erneuert) das Token und verschickt die E-Mail an die Kunden-Adresse."""
	doc = frappe.get_doc("Site Visit", site_visit)
	doc.check_permission("write")

	if not doc.customer:
		frappe.throw(_("Please select a Customer first."))

	email = frappe.db.get_value("Customer", doc.customer, "email_id")
	if not email:
		frappe.throw(_("Customer {0} has no email address on file.").format(doc.customer))

	token = secrets.token_urlsafe(32)
	doc.db_set("remote_signature_token", token)
	doc.db_set("remote_signature_sent_at", now_datetime())

	link = f"{frappe.utils.get_url()}/site-visit-sign?name={doc.name}&key={token}"
	frappe.sendmail(
		recipients=[email],
		subject=_("Please sign your service visit: {0}").format(doc.name),
		message=_(
			"Please open the link below to review and sign your service visit report:<br><br>"
			'<a href="{0}">{0}</a><br><br>This link is valid for {1} days.'
		).format(link, TOKEN_VALID_DAYS),
		now=True,
	)
	return link


def _validate_token(doc, key):
	if not doc.remote_signature_token or not key or not secrets.compare_digest(doc.remote_signature_token, key):
		frappe.throw(_("Invalid or expired signing link."), frappe.PermissionError)

	if not doc.remote_signature_sent_at:
		frappe.throw(_("Invalid or expired signing link."), frappe.PermissionError)

	if now_datetime() > add_to_date(doc.remote_signature_sent_at, days=TOKEN_VALID_DAYS):
		frappe.throw(_("This signing link has expired. Please ask for a new one."), frappe.PermissionError)

	if doc.docstatus != 0:
		frappe.throw(_("This Site Visit has already been submitted."), frappe.PermissionError)

	if doc.customer_signature:
		frappe.throw(_("This Site Visit has already been signed."), frappe.PermissionError)


def get_signing_context(name, key):
	"""Fuer die oeffentliche Seite www/site-visit-sign: liefert die
	Anzeigedaten, wirft bei ungueltigem/abgelaufenem Token/Namen ab."""
	doc = frappe.get_doc("Site Visit", name)
	_validate_token(doc, key)
	return {
		"name": doc.name,
		"customer_name": doc.customer_name,
		"date": frappe.utils.format_date(doc.date),
		"description": doc.description,
	}


@frappe.whitelist(allow_guest=True)
def submit_remote_signature(name, key, signature, signee_name=None):
	"""Speichert die per Fernlink erfasste Unterschrift. allow_guest, da der
	Kunde keinen eigenen Login hat - die Absicherung laeuft ausschliesslich
	ueber das Token (siehe _validate_token)."""
	doc = frappe.get_doc("Site Visit", name)
	_validate_token(doc, key)

	if not signature:
		frappe.throw(_("Please provide a signature."))

	doc.db_set("customer_signature", signature)
	doc.db_set("signee_name", signee_name or doc.customer_name)

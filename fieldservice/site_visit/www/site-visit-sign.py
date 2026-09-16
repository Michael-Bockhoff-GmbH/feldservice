import frappe

no_cache = 1


def get_context(context):
	"""Oeffentliche Seite (kein Login) zum Fern-Unterschreiben eines Site
	Visit - siehe remote_signature.py fuer die Token-Pruefung. Wirft bei
	ungueltigem/abgelaufenem Link ueber get_signing_context() ab, Frappes
	Website-Framework zeigt das dann als Fehlerseite an."""
	from fieldservice.site_visit.remote_signature import get_signing_context

	name = frappe.form_dict.get("name")
	key = frappe.form_dict.get("key")
	if not name or not key:
		frappe.throw("Missing link parameters.", frappe.PermissionError)

	context.visit = get_signing_context(name, key)
	context.name = name
	context.key = key
	context.no_sidebar = 1

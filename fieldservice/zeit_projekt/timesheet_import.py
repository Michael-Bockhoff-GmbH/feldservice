import frappe


@frappe.whitelist()
def get_timesheet_data(project=None, sales_order=None, from_time=None, to_time=None):
	"""Wie erpnext.projects.doctype.timesheet.timesheet.get_projectwise_timesheet_data,
	aber zusaetzlich mit dem Auftrag der Zeile (custom_sales_order, siehe
	install.py) und optionalem Filter darauf. sales_order filtert dabei nur
	die angezeigte/importierte Auswahl - ohne den Filter (Standardfall)
	kommen weiterhin alle abrechenbaren Zeiten des Projekts, unabhaengig vom
	Auftrag."""
	if not frappe.has_permission("Sales Invoice", "write"):
		frappe.throw(frappe._("Not permitted"), frappe.PermissionError)

	tsd = frappe.qb.DocType("Timesheet Detail")
	ts = frappe.qb.DocType("Timesheet")

	query = (
		frappe.qb.from_(tsd)
		.inner_join(ts)
		.on(ts.name == tsd.parent)
		.select(
			tsd.name.as_("name"),
			tsd.parent.as_("time_sheet"),
			tsd.from_time.as_("from_time"),
			tsd.to_time.as_("to_time"),
			tsd.billing_hours.as_("billing_hours"),
			tsd.billing_amount.as_("billing_amount"),
			tsd.activity_type.as_("activity_type"),
			tsd.description.as_("description"),
			tsd.project_name.as_("project_name"),
			tsd.custom_sales_order.as_("sales_order"),
		)
		.where((tsd.parenttype == "Timesheet") & (tsd.docstatus == 1) & (tsd.is_billable == 1) & tsd.sales_invoice.isnull())
	)

	if project:
		query = query.where(tsd.project == project)
	if sales_order:
		query = query.where(tsd.custom_sales_order == sales_order)
	if from_time:
		query = query.where(tsd.from_time >= from_time)
	if to_time:
		query = query.where(tsd.to_time <= to_time)

	return query.run(as_dict=True)

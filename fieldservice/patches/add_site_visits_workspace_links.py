from fieldservice.install import _site_visits_workspace_links_enable


def execute():
	"""Traegt Kalender-/Einsatzplan-Verknuepfung auf der "Site Visits"-
	Workspace nach - siehe _site_visits_workspace_links_enable() in
	install.py fuer den Hintergrund (Fixture-Sync allein reicht dafuer auf
	bereits installierten Benches nicht). Muss nach dem Schema-Sync laufen
	(post_model_sync), da die Page "dispatch-board" vorher noch nicht
	existiert - idempotent, daher gefahrlos erneut ausfuehrbar."""
	_site_visits_workspace_links_enable()

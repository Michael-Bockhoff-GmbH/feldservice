import erpnext
from frappe.model.document import Document

from fieldservice.site_visit.site_visit import warn_schedule_conflicts


class SiteVisit(Document):
	def validate(self):
		if not self.company:
			self.company = erpnext.get_default_company()
		warn_schedule_conflicts(self)

from django.urls import path

from .views import detailed_export_view, report_overview_view, report_timeline_view, sale_pdf_export_view

app_name = "reports"

urlpatterns = [
    path("", report_overview_view, name="overview"),
    path("timeline/", report_timeline_view, name="timeline"),
    path("export/detailed.csv", detailed_export_view, name="export_detailed_csv"),
    path("export/sale.pdf", sale_pdf_export_view, name="export_sale_pdf"),
]

from django.urls import path

from .views import (
    detailed_export_view,
    report_overview_view,
    report_timeline_view,
    sale_pdf_export_view,
    sale_report_html_view,
    sale_report_public_view,
    sale_report_share_create_view,
    sale_report_share_revoke_view,
    sale_report_weasyprint_view,
)

app_name = "reports"

urlpatterns = [
    path("", report_overview_view, name="overview"),
    path("timeline/", report_timeline_view, name="timeline"),
    path("export/detailed.csv", detailed_export_view, name="export_detailed_csv"),
    path("export/sale.pdf", sale_pdf_export_view, name="export_sale_pdf"),
    path("sale-report/<int:pk>/", sale_report_html_view, name="sale_report_html"),
    path("sale-report/<int:pk>/share/", sale_report_share_create_view, name="sale_report_share_create"),
    path("sale-report/share/<int:pk>/revoke/", sale_report_share_revoke_view, name="sale_report_share_revoke"),
    path("sale-report/<int:pk>/pdf/", sale_report_weasyprint_view, name="sale_report_pdf"),
    path("sale/public/<str:token>/", sale_report_public_view, name="sale_report_public"),
]

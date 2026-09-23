# Subscription and receipt OCR unit economics

Checked 23 September 2026. Recheck provider tariffs before changing prices.

The live Stripe Pro prices are R$14.90 monthly and R$99.00 yearly. At the
published Stripe Billing rate of 0.7% of billing volume and its listed
Brazilian card rate of 3.99% + R$0.50 per successful payment, estimated
receipts after those Stripe charges are R$13.70 per monthly payment and
R$93.86 per yearly payment (R$7.82 per month of service). Actual fees vary by
payment method, card origin, and account agreement. Taxes, refunds, disputes,
Neon, Cloudflare, support, and other operating costs are excluded.

Mistral's `mistral-ocr-latest` currently points to OCR 4.1 at US$4 per 1,000
pages, or US$0.004 per page. For illustration, at R$5 per US$1 this is R$0.02
per scanned receipt page. A rider scanning 50 receipts per month would cost
about R$1 per month in OCR charges; 200 scans would cost about R$4. The yearly
plan leaves about R$7.82 per month after the stated Stripe charges, so roughly
390 pages per month would consume that amount in OCR alone at the illustrative
exchange rate. This is a sensitivity calculation, not a profit forecast.

Fuel receipt OCR now asks Mistral for only the first page of a PDF. An image
is one page already. That bounds page charges for one scan while preserving
the usual one-page receipt workflow. Account-level scan counts are not yet
metered, so repeated scans and Free accounts remain an open cost exposure.
Before scaling paid acquisition, record scans and provider invoices without
retaining receipt contents, then add a fair per-account allowance or abuse
control if observed usage threatens the annual-plan margin. Do not raise the
public price based solely on this theoretical worst case.

Sources: [live Mistral API pricing](https://mistral.ai/pricing/api/),
[Mistral OCR page selection](https://docs.mistral.ai/api/endpoint/ocr), and
[Stripe Billing pricing in Brazil](https://stripe.com/br/billing/pricing).

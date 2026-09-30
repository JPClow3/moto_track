# Subscription and receipt OCR unit economics

Updated 29 September 2026. Recheck provider tariffs and the account agreement
before changing prices. Intended Pro base prices remain R$14.90 monthly
and R$99.00 yearly; confirm configured products and checkout totals before
production cutover.

Dodo Payments' public Standard schedule lists 4% + US$0.40 for US card/wallet
transactions, an additional 1.5% for international payments, and an additional
0.5% for subscriptions. Other methods, payouts, refunds, disputes, conversion,
and account-specific terms can change the result. Do not treat public rates
as a verified Moto Track settlement quote.

For illustration only, those percentages total 6% for an international card
subscription. At an assumed R$5 per US$1, the fixed fee is R$2. This leaves
R$12.006 per R$14.90 monthly payment or R$91.06 per R$99 yearly payment
(about R$7.59 per month). This is a sensitivity calculation, not an invoice,
settlement prediction, or profit forecast. Dodo Payments acts as Merchant of
Record; check actual taxes and checkout totals in product configuration.
Neon, Cloudflare, support, and other costs are excluded. Reconcile the first
real fee/settlement report before accepting these assumptions as a pricing input.

The Mistral check on 23 September 2026 recorded `mistral-ocr-latest` at
US$4 per 1,000 pages, or US$0.004 per page. This dated baseline needs a fresh
provider check before changing OCR allowances. At R$5 per US$1 this is R$0.02
per scanned receipt page. A rider scanning 50 receipts per month would cost
about R$1 per month in OCR charges; 200 scans would cost about R$4. The yearly
plan leaves about R$7.59 per month after the illustrative Dodo Payments fees,
so roughly 379 pages per month would consume that amount in OCR alone at that
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
[Dodo Payments pricing](https://dodopayments.com/pricing).

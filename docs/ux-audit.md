# UI/UX audit — cognitive load and phone use

Date: 2026-10-31. Scope: the signed-in app (`src/routes/(app)`), onboarding,
auth and the public entry pages, judged at 375px.

Method: a code review of every app route and shared component, plus a live
check at 375×812 of `/`, `/demo` and `/auth`. The signed-in screens were not
checked live (they need a real Neon Auth session), so their findings come
from the markup. Data-dependent layouts should get a live pass with a real
account.

## Summary

The foundations are solid. Inputs are 16px (no iOS zoom), targets are 44px,
safe-area insets are respected, decimal fields accept `4,59`, tables stack on
phones and empty states replace layouts. The cognitive load comes from
**too many ways to do the same thing**, **flat long forms** and **secondary
features placed next to primary actions**, not from the visual design.

Three themes cover most of the findings:

1. **One intent, one path.** "Add a record", "which bike" and "what is due"
   each have 3–4 entry points that behave differently.
2. **Ask for the minimum, reveal the rest.** The fuel form shows 13 fields
   for a task that needs 3.
3. **Primary action first.** Cards and pages lead with delete, marketplace,
   charts and settings before the thing the rider came to do.

---

## High impact

### H1. Three "add" buttons on the dashboard, each different

On a phone the dashboard shows:

- the header **+** (`PageAction`), which opens a **centred modal**
  (`ActionMenu`) with 4 choices: fuel, service, expense, document
  ([dashboard/+page.svelte:248](<../src/routes/(app)/dashboard/+page.svelte>))
- a **3-button quick-log grid**: fuel, service, expense (`:496`)
- the bottom-bar **+**, which opens a **bottom sheet** with 3 choices: fuel,
  service, expense ([AppShell.svelte:298](../src/lib/components/AppShell.svelte))

On a record page the header **+** and the bar **+** are both visible and do
different things.

The same "add fuel" intent also lands on different screens depending on
where it starts:

- `/fuel?new=1` (quick log) opens **Repetir último** when a previous record
  exists, otherwise the manual form
  ([fuel/+page.svelte:171](<../src/routes/(app)/fuel/+page.svelte>))
- the fuel header **+** opens another chooser first (scan / manual / repeat)

**Recommendation**

- Make the bottom-bar **+** the only global add. Give it 4 options
  (add documents) in one bottom sheet.
- Remove the dashboard header **+**. Keep the quick-log grid only if it earns
  its space, otherwise remove it too.
- On record pages the header **+** opens that page's form directly, with no
  chooser. Put **Escanear comprovante** and **Repetir último** as buttons at
  the top of the fuel form. Every entry point then reaches the same form.

### H2. The fuel form asks for 13 fields

Manual entry ([fuel/+page.svelte:1157](<../src/routes/(app)/fuel/+page.svelte>)):
bike, date, odometer, litres, total, price per litre, saved station, saved
grade, station name, fuel type, tank full, notes, receipt. Only odometer,
litres and total are needed; the rest are defaults or extras.

There are also duplicate concepts:

- **Posto cadastrado** (select) and **Nome do posto** (free text)
- **Combustível cadastrado** (select) and **Tipo** (select)
- price per litre is derivable from total ÷ litres, but it sits among the
  required fields

The OCR review form repeats the same 12 fields.

**Recommendation**

- Visible by default: **Odômetro, Litros, Total**. Show bike and date as
  pre-filled chips ("Moto: CB 300 · Hoje"), tap to change.
- Put everything else under one **Mais detalhes** disclosure.
- Merge the station fields into one combobox (saved stations as suggestions,
  free text allowed). Merge grade and type into one field.
- Show the computed price per litre as read-only feedback ("R$ 6,19/L")
  instead of a field.

### H3. Save buttons scroll away on phones

`RecordSheet` has a `footer` slot, but no page uses it
(`grep 'slot="footer"'` → 0). Every sheet puts Cancel/Save at the end of the
scrolling body. With 10+ fields and the keyboard open, the rider has to
scroll past the keyboard to find Save.

**Recommendation:** move the form actions into the `footer` slot (with
`form="…"` on the submit button) so Save stays pinned above the keyboard in
every sheet.

### H4. Maintenance cards have no "done" action

A due plan card
([maintenance/+page.svelte:570](<../src/routes/(app)/maintenance/+page.svelte>))
shows:

- a red trash button in the top-right corner, the most prominent control
- **Buscar itens deste plano** (marketplace)
- **Corrigir histórico inicial**, which expands a 3–4 field form inside the
  card

It does not show the action the card exists for: **"I did this service"**.
To close a plan, the rider has to open **Serviço** in the header and fill
the type, bike and odometer again.

**Recommendation**

- Make **Registrar como feito** the card's primary button. It opens the log
  sheet pre-filled with type, bike, today's date and current odometer.
- Move delete, history correction and marketplace into a ⋯ menu on the card.

### H5. Up to four bike selectors on one page, and they disagree

On `/fuel` with two or more bikes:

1. the header `BikeSwitcher` (global)
2. the `BikeContextBar` select, which adds **Todas as motos**
3. the filter panel select
4. the form's bike select

Changing the page-level select does **not** change the header
([fuel/+page.svelte:86](<../src/routes/(app)/fuel/+page.svelte>),
[maintenance/+page.svelte:89](<../src/routes/(app)/maintenance/+page.svelte>)),
so the header can say bike A while the page shows bike B. The dashboard
adds a fifth control (the hero chips, `:350`).

**Recommendation**

- The header switcher is the only bike context. Remove the page-level
  selects on fuel, maintenance and tires, and the dashboard chips.
- Forms show the active bike as a chip, tap to change.
- Keep **Todas as motos** only as a History filter.

### H6. The phone dashboard is about 10 blocks long

In order: a 160px photo hero, next due, attention list, quick log, 2 metric
cards, consumption chart, costs (bars and donut), activity with heatmap, and
the anonymous benchmark with a consent form. The question "does my bike
need anything?" is answered below the photo; everything after that is
analysis.

**Recommendation**

- Above the fold on phones: a compact hero (name, km, health, no photo or
  ≤96px), then **Próximo**, then quick log.
- Move the consumption chart, costs, heatmap and benchmark to **Análises**
  (`/reports`). Keep one cost metric linking there.
- The benchmark (opt-in data sharing, model select, consent checkbox) does
  not belong on the home screen.

### H7. Onboarding step 2 is a long quiz that ends in alerts

`InitialHistoryStep` renders one fieldset with 3 radios for **every** plan
item ([InitialHistoryStep.svelte](../src/lib/components/InitialHistoryStep.svelte)).
The default is **Não sei confirmar**, and the copy explains that "não sei"
becomes attention now. A rider who taps through gets a first dashboard
full of amber items, at the moment they are deciding whether the app is
worth it.

**Recommendation**

- Replace the per-item quiz with one question: "A revisão está em dia?"
  Sim / Não / Não sei. Apply it to every item and offer "ajustar item a
  item" as an optional link.
- Make the step skippable.
- Show unknown items in a neutral "confirm" tone instead of the due-soon
  amber, so the first screen is not a list of warnings.

---

## Medium impact

### M1. Fuel and tire records cannot be edited

`fuel` and `tires` have no update action; only delete (count of
`action="?/update` = 0). A typo in a fill-up means delete and re-enter
everything. Each fuel row also carries a red **Excluir** button
([fuel/+page.svelte:833](<../src/routes/(app)/fuel/+page.svelte>)), which is
visual noise on every row and puts a destructive action within easy reach
of a thumb.

**Recommendation:** tapping a row opens an edit sheet with delete inside it,
as `FeaturePage` already does for expenses and documents.

### M2. "What is due" lives in three places with two names

The dashboard (**Próximo**), the **Manutenção** page (plans with
**A seguir**) and the **Lembretes** tab all show due items. The dashboard
already merges plans and reminders into one list (`home.kindMaintenance` /
`home.kindReminder`), but the navigation separates them. Riders do not
think in terms of "maintenance plan" versus "reminder".

**Recommendation:** consider one **Próximos** tab that lists plans and
reminders together (as the dashboard already does), and let **Manutenção**
be the service history. This also frees the bottom bar: Fuel and
Maintenance, the most-used record types, are currently two taps away
behind **Mais**.

### M3. Overflow menus hold settings and power features

- Fuel ⋯ has 8 items: export CSV, filters, import, offline drafts, fill-up
  defaults, stations, grades, review
  ([fuel/+page.svelte:444](<../src/routes/(app)/fuel/+page.svelte>)).
- Maintenance ⋯ has 6: schedule, workshops, parts, marketplace, photos,
  export.
- Reminders shows calendar subscription (ICS download, secret URL,
  revoke) inline on the main page
  ([reminders/+page.svelte](<../src/routes/(app)/reminders/+page.svelte>)).

Filters, which a rider does use, are hidden in ⋯. Preferences, which are set
once, are next to everyday actions.

**Recommendation**

- Make filters a visible chip row above the list (period · posto).
- Move defaults, stations, grades and calendar sync to **Conta**
  (Preferências), and CSV import/export to **Conta › Dados**.

### M4. Three different sheet patterns

On phones the app uses a bottom sheet (`BottomSheet`, quick log and Mais), a
bottom-anchored dialog (`RecordSheet`, forms) and a **centred modal**
(`ActionMenu`, the dashboard and fuel choosers). The centred modal sits out
of thumb reach and looks different.

**Recommendation:** on phones every chooser should be a bottom sheet. With H1
done, `ActionMenu` may not be needed at all.

### M5. The list is pushed below the fold on record pages

`/fuel` on a phone: title and subtitle, bike context bar, signal strip,
trend chart, nearby stations, filters, then the history list. Every app
page has a `pageSubtitle` that repeats the title.

**Recommendation:** drop page subtitles in the app. On record pages lead
with the signal strip and the list, and move charts to Análises or below
the list.

### M6. Copy that needs translating into rider language

- **Corrigir histórico inicial**, **Lembrete inicial**, **Intervalo do
  manual**
- Confidence labels on the next-due card (confirmed / not done / unknown)
- **Posto cadastrado** vs **Nome do posto**, **Combustível cadastrado** vs
  **Tipo**
- **Comparativo anônimo**

**Recommendation:** one plain verb per action ("Já fiz", "Ajustar
última troca") and drop the confidence labels where the status badge
already says it.

---

## Low impact and polish

- **Auth:** the password placeholder `••••••••` looks like a saved password
  at a glance. Use no placeholder or "Sua senha".
- **Locale switcher:** the submit button is `py-1 text-xs`
  ([LocaleSwitcher.svelte:46](../src/lib/components/LocaleSwitcher.svelte)),
  under the 44px target. Submit on change instead.
- **Maintenance types:** the `datalist` is hard-coded in Portuguese
  ([maintenance/+page.svelte:482](<../src/routes/(app)/maintenance/+page.svelte>)),
  so English users get Portuguese suggestions. `datalist` is also weak on
  iOS. Use tappable chips of the common types instead.
- **Header on phones:** the bar shows a logo and the bike switcher; the
  logo duplicates the **Moto** tab. Give the bike name the full width.
- **Landing page:** about 8,000px (≈10 screens) at 375px. Fine for
  marketing, but the second CTA could move up to keep "Explorar
  demonstração" in view.

---

## What already works

- 16px inputs, `min-h-11` targets, `inputmode="decimal"` and comma decimals
- `env(safe-area-inset-*)` on the bottom bar and sheets
- Empty states that replace the layout and give one action
- One-red rule: red only for overdue, which makes alerts readable
- Focus trapping and focus restore in sheets; a skip link
- Quick-log deep links (`?new=1`) and toast feedback after saves
- Tables that collapse to stacked rows below 640px

## Suggested order

| #   | Change                                  | Effort | Why first                                  |
| --- | --------------------------------------- | ------ | ------------------------------------------ |
| 1   | H3 pinned Save in sheets                | S      | One component change, every form benefits  |
| 2   | H2 fuel form to 3 fields + disclosure   | M      | The most frequent task                     |
| 3   | H1 one add path                         | S–M    | Removes the biggest source of "which one?" |
| 4   | H4 "Registrar como feito" on plan cards | M      | Closes the core maintenance loop           |
| 5   | H5 single bike context                  | M      | Removes a real inconsistency bug           |
| 6   | M1 edit for fuel/tires                  | M      | Recover from typos without re-entry        |
| 7   | H6 shorter phone dashboard              | M      | Answer "does my bike need me?" first       |
| 8   | H7 onboarding history                   | M      | First impression and activation            |
| 9   | M2–M6, polish                           | —      | Follow-ups                                 |

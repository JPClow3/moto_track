# Mobile & Monetization Strategy

> Strategic roadmap for transforming Moto Track from a personal maintenance tracker into a **work vehicle profitability platform** targeting motoboys and mototáxis in Brazil.

---

## Table of Contents

- [Phase 1 — PWA (Production Target)](#phase-1--pwa-production-target)
- [Phase 2 — Android via TWA](#phase-2--android-via-twa)
- [Phase 3 — Native (Only If Needed)](#phase-3--native-only-if-needed)
- [Monetization Model](#monetization-model)
- [Critical Missing Features for Professionals](#critical-missing-features-for-professionals)
- [Free vs Pro Feature Matrix](#free-vs-pro-feature-matrix)
- [Production Readiness Checklist](#production-readiness-checklist)
- [Implementation Roadmap](#implementation-roadmap)

---

## Phase 1 — PWA (Production Target)

**This is the immediate production target.**

### Why PWA First

- One codebase — no parallel maintenance.
- Works on any Android browser today.
- Can be "installed" to home screen (A2HS prompt already exists).
- Matches the existing server-rendered Django + HTMX architecture.
- Much faster than a Flutter/Kotlin rewrite.
- Good enough for real-world testing with motoboys/mototáxis.

### PWA Requirements

| Requirement | Status | Notes |
| :--- | :---: | :--- |
| Installable (manifest + SW) | ✅ | `manifest.webmanifest` + `sw.js` exist |
| Good mobile layout | 🔧 | Needs polish pass on forms & dashboard |
| Offline fallback page | ✅ | `offline.html` exists |
| Fast cold load | 🔧 | WhiteNoise serves static; audit LCP/FID |
| Push notifications | ✅ | Web Push infrastructure exists |
| Camera/file upload | ✅ | `receipt_file` fields accept camera input |
| Session persistence | ✅ | Django session cookies + "remember me" |
| Reliable forms on bad internet | ❌ | **Biggest gap** — needs offline-tolerant queueing |

### Key Insight

> For motoboys, the biggest missing piece is not "native Android" — it is **offline-tolerant usage**. They register fuel/maintenance between rides, in weak signal, at gas stations, or during work.

### PWA Hardening Tasks

1. **Offline form queue** — intercept form submissions in the Service Worker; store in IndexedDB; replay when online.
2. **Background sync** — use the Background Sync API to retry failed POSTs.
3. **Optimistic UI** — show "saved locally, syncing..." feedback via Alpine.js state.
4. **Cache strategy** — cache dashboard shell + static assets aggressively; network-first for data endpoints.
5. **App shell architecture** — ensure the base layout renders instantly from cache.
6. **Lighthouse audit** — target 90+ on PWA, Performance, and Accessibility.

---

## Phase 2 — Android via TWA

**After the PWA is polished**, package it as an Android app using **Trusted Web Activity** (not a generic WebView wrapper).

### When to Use TWA

- You want Play Store presence and a real app icon.
- You do not want to maintain native UI.
- Your web app is already responsive and PWA-compliant.

### How TWA Works

```text
Android shell → opens your PWA fullscreen → keeps web app as source of truth
```

### Why TWA Over Capacitor/WebView

| Concern | TWA | WebView/Capacitor |
| :--- | :--- | :--- |
| Auth/cookies | Chrome-native | Can break |
| File upload | Works like browser | Can be flaky |
| Push notifications | Web Push (already built) | Needs native bridge |
| Back button | Chrome behavior | Must handle manually |
| Play Store review | Accepted pattern | Can feel "wrapped" |
| Maintenance | Zero native code | Plugin updates, breaking changes |

### TWA Implementation Steps

1. Generate `assetlinks.json` for Digital Asset Links verification.
2. Create minimal Android project with `TrustedWebActivityIntentBuilder`.
3. Configure `AndroidManifest.xml` with splash screen, theme color, and orientation.
4. Sign APK/AAB and upload to Play Console.
5. Validate push notifications, camera access, and deep links work end-to-end.

---

## Phase 3 — Native (Only If Needed)

**Only consider Flutter/Kotlin later** if you need capabilities that cannot be delivered via PWA/TWA:

- True offline-first sync (conflict resolution, CRDT)
- Background GPS tracking
- Automatic route recording
- Automatic mileage detection
- Native camera/OCR pipeline
- Background notifications with more control
- Bluetooth/OBD-II integration
- Deep Android integrations (sensors, widgets)

> **A native rewrite now would be premature.** You would spend months rebuilding forms, auth, validation, navigation, payments, offline sync, and UI — before proving people will pay.

---

## Monetization Model

### Pricing Philosophy

For Brazil, targeting motoboys and mototáxis — **do not start with many tiers**. Too much choice kills conversion.

### Tier Structure

| Tier | Price | Target |
| :--- | :--- | :--- |
| **Free** | R$ 0 | Habit-forming core usage |
| **Pro** | R$ 14,90/mês or R$ 129/ano | Professional insight & profitability tools |
| **Fleet** *(later)* | R$ 9,90–19,90/moto/mês | Small delivery companies, moto rental, associations |

### Price Testing Range

| Model | Aggressive | Sweet Spot | Premium |
| :--- | :---: | :---: | :---: |
| Monthly | R$ 9,90 | **R$ 14,90** | R$ 19,90 |
| Annual | R$ 99 | **R$ 129** | R$ 149 |

> R$ 14,90 is psychologically acceptable if the app clearly saves money or helps track profit. But it must **prove value quickly**.

### Fleet Pricing (Phase 3+)

- R$ 49/month — up to 5 motorcycles
- R$ 99/month — up to 15 motorcycles
- Custom pricing after that

> Do not build fleet features first. The product will become too complex.

### Payment Providers (Brazil)

| Provider | Notes |
| :--- | :--- |
| **Stripe** | If available for your setup |
| **Mercado Pago** | Strong Pix support, known brand |
| **Pagar.me** | Developer-friendly APIs |
| **Asaas** | Good for recurring billing |
| **Iugu** | Established in BR SaaS |

**Payment priorities:**

- Pix recurring + cartão
- Monthly + annual plan toggle
- Simple cancellation flow
- Webhook-driven plan activation

---

## Critical Missing Features for Professionals

The current product is a **personal motorcycle maintenance tracker**. For motoboys/mototáxis, it needs to become a **work vehicle profitability tracker**.

### 1. Income Tracking

Track money earned, not only costs.

**Fields:**

- Daily revenue
- Platform/app source: iFood, Uber, 99, Loggi, private, mototáxi
- Payment method: cash / card / Pix
- Tips
- Number of deliveries/rides
- Hours worked

**Core metric:**

```text
profit per day = revenue − fuel − maintenance provision − fixed costs
```

### 2. Work Sessions ("Turnos")

A shift/session model:

| Field | Example |
| :--- | :--- |
| Start time | 07:00 |
| End time | 15:30 |
| Km initial | 42.310 |
| Km final | 42.452 |
| Revenue | R$ 180 |
| Fuel spent | R$ 42 |
| Hours worked | 8.5h |

**Derived metrics:**

- R$/hora
- R$/km
- Lucro líquido estimado
- Km rodados no dia

> This is probably the **most important Pro feature**.

### 3. Real Cost per Km (with Maintenance Provision)

For professionals, fuel is not the only cost. The app should estimate:

| Component | Example |
| :--- | :--- |
| Fuel cost/km | R$ 0,30 |
| Tire cost/km | R$ 0,04 |
| Oil cost/km | R$ 0,03 |
| Brake pads cost/km | R$ 0,02 |
| Chain kit cost/km | R$ 0,02 |
| Insurance + tax/day | R$ 3,50 |
| Depreciation estimate | R$ 0,05 |
| **Real cost/km** | **R$ 0,46** |

**Example output:**

```text
Você faturou R$ 180 hoje.
Rodou 142 km.
Custo estimado: R$ 63.
Lucro estimado: R$ 117.
```

> This is the **killer feature**. Much stronger than "histórico de manutenção".

### 4. Maintenance Reserve

Help motoboys know how much to set aside:

```
Reserve R$ 0,12/km for maintenance
Today you rode 142 km
→ Set aside R$ 17,04
```

Makes the app **financially useful** beyond logging.

### 5. Fast Daily Close

A professional user needs a **very fast** end-of-day flow:

```text
┌─────────────────────────────┐
│     Finalizar Dia           │
├─────────────────────────────┤
│ Km inicial:    [42.310    ] │
│ Km final:      [42.452    ] │
│ Ganhos do dia: [R$ 180    ] │
│ Combustível:   [R$ 42     ] │
│ Observações:   [__________] │
│                             │
│        [ Salvar ]           │
└─────────────────────────────┘
```

Do not make them enter everything in separate modules every time.

### 6. Receipt & Tax Organization

For Pro users:

- Fuel receipts (photo capture)
- Maintenance receipts
- Document storage with expiry tracking
- Monthly PDF/CSV export
- MEI expense organization

### 7. Professional Reminders

Not generic reminders — **practical** reminders:

| Reminder | Why |
| :--- | :--- |
| CNH expiry | Legal requirement |
| Licensing expiry | Cannot ride without it |
| Insurance expiry | Financial protection |
| Oil change | Based on km interval |
| Tire inspection | Safety |
| Brake check | Safety |
| Chain lubrication | Longevity |
| Daily tire pressure | Fuel economy + safety |

### 8. "Is Today Worth It?" Dashboard

**This is the screen that sells the subscription.**

```text
┌─────────────────────────────────────┐
│            HOJE                      │
├─────────────────────────────────────┤
│  Faturamento:         R$ 180        │
│  Combustível:        −R$ 42         │
│  Reserva manutenção: −R$ 17         │
│  ─────────────────────────────      │
│  Lucro estimado:      R$ 121        │
│                                     │
│  R$/hora:  R$ 18,60                 │
│  R$/km:    R$ 0,85                  │
└─────────────────────────────────────┘
```

---

## Free vs Pro Feature Matrix

| Feature | Free | Pro |
| :--- | :---: | :---: |
| 1 motorcycle | ✅ | ✅ |
| Fuel logging | ✅ | ✅ |
| Maintenance logging | ✅ | ✅ |
| Basic reminders | ✅ | ✅ |
| Basic history | ✅ | ✅ |
| Basic dashboard | ✅ | ✅ |
| Multiple motorcycles | ❌ | ✅ |
| Documents/photos | Limited | ✅ |
| Advanced reports | ❌ | ✅ |
| Work sessions | ❌ | ✅ |
| Income tracking | Basic | ✅ |
| Profit per day/month | ❌ | ✅ |
| Cost per km breakdown | ❌ | ✅ |
| Maintenance reserve | ❌ | ✅ |
| CSV/PDF export | ❌ | ✅ |
| Public sale report | ❌ | ✅ |
| OCR receipt scan | ❌ | ✅/add-on |

> **Principle:** Do not lock basic fuel/maintenance. Lock **professional insight**.

---

## Production Readiness Checklist

### Product

- [ ] Mobile UX is excellent (forms, navigation, touch targets)
- [ ] Onboarding is short (< 60 seconds to first value)
- [ ] Registration flow is very fast
- [ ] History is searchable
- [ ] Dashboard explains value immediately
- [ ] Offline form queue works reliably

### Reliability

- [ ] Automatic database backups
- [ ] Migration discipline (no breaking changes)
- [ ] Error monitoring (Sentry — already integrated)
- [ ] Structured logging
- [ ] Admin support tools
- [ ] Email verification flow
- [ ] Password reset flow
- [ ] Rate limiting (login, API)
- [ ] File upload validation (type, size)
- [ ] Storage limits per plan

### Legal / Commercial (Brazil)

- [ ] Terms of Use (Termos de Uso)
- [ ] Privacy Policy (Política de Privacidade)
- [ ] LGPD-compliant data handling
- [ ] Clear cancellation policy
- [ ] Billing/invoice flow (nota fiscal)
- [ ] Support contact channel
- [ ] Data deletion/export request flow (LGPD Art. 18)

### Payment

- [ ] Payment provider integrated (Stripe / Mercado Pago / Pagar.me)
- [ ] Pix + cartão support
- [ ] Monthly + annual plan toggle
- [ ] Simple cancellation (no dark patterns)
- [ ] Webhook-driven plan activation/deactivation
- [ ] Grace period handling
- [ ] Failed payment retry flow

### Android (TWA)

- [ ] `assetlinks.json` configured and deployed
- [ ] Play Store listing (screenshots, description, icon)
- [ ] Push notification validation on Android
- [ ] Camera/file upload validated
- [ ] Back button behavior tested
- [ ] Google Play Billing compliance review (if selling in-app)

---

## Implementation Roadmap

### v1.0 — Production Web/PWA

| Priority | Task |
| :--- | :--- |
| 🔴 High | Responsive mobile polish (forms, dashboard, navigation) |
| 🔴 High | "Registrar" modal as primary action (FAB or sticky button) |
| 🔴 High | Offline form queue (Service Worker + IndexedDB) |
| 🔴 High | PWA installable + push reminders working |
| 🔴 High | Privacy policy + terms of service |
| 🟡 Medium | Dashboard simplified for mobile |
| 🟡 Medium | History promoted and searchable |
| 🟡 Medium | Lighthouse 90+ audit |
| 🟡 Medium | Payment-ready architecture (plan model, feature flags) |
| 🟢 Low | Background sync for queued submissions |

### v1.5 — Professional Tracking

| Priority | Task |
| :--- | :--- |
| 🔴 High | Work sessions (turno) model + quick form |
| 🔴 High | Daily revenue tracking |
| 🔴 High | Daily profit calculation |
| 🔴 High | Cost per km with maintenance provision |
| 🟡 Medium | Maintenance reserve calculator |
| 🟡 Medium | "Fast daily close" single-screen flow |
| 🟡 Medium | Monthly professional report (PDF export) |
| 🟢 Low | Platform source tracking (iFood, Uber, 99, etc.) |

### v2.0 — Android

| Priority | Task |
| :--- | :--- |
| 🔴 High | TWA wrapper + Play Store listing |
| 🔴 High | Digital Asset Links (`assetlinks.json`) |
| 🔴 High | Push notification validation on Android |
| 🟡 Medium | Camera/file upload validation |
| 🟡 Medium | Android back button behavior |
| 🟡 Medium | Splash screen + theme color |
| 🟢 Low | Play Store optimization (ASO) |

### v3.0 — Paid Pro

| Priority | Task |
| :--- | :--- |
| 🔴 High | Free + Pro tier implementation |
| 🔴 High | Payment provider integration |
| 🔴 High | Feature flag system (plan-gated views) |
| 🔴 High | Billing portal (upgrade, downgrade, cancel) |
| 🟡 Medium | Professional reports locked behind Pro |
| 🟡 Medium | Annual plan discount |
| 🟡 Medium | Trial period (7 or 14 days) |
| 🟢 Low | Referral/discount codes |

---

## Summary

```text
Recommendation: PWA-first + Android TWA wrapper
Do NOT do native now.

Free tier: habit-forming core logging
Pro tier: professional insight & profitability tools
Fleet tier: later, after product-market fit

Key product shift:
  FROM → personal motorcycle maintenance tracker
  TO   → work vehicle profitability tracker

The screen that sells the subscription:
  "Lucro estimado hoje: R$ 121 · R$ 18,60/hora"
```

---

> *Strategy document — Moto Track · Last updated: May 2025*

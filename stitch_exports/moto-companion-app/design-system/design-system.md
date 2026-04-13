# Design System: Quiet Utility Premium

## 1. Overview & Creative North Star: "The Mechanical Atelier"
The North Star for this design system is **"The Mechanical Atelier."** In motorcycle management, precision is paramount, but the experience should never feel frantic. This system rejects the cluttered, "dashboard-heavy" tropes of automotive software in favor of an editorial, high-end technical manual. 

We achieve "Quiet Utility" through **intentional asymmetry**—offsetting metadata from primary headers—and **tonal depth**. By utilizing generous negative space and a rigorous rejection of structural lines, the UI feels like a series of meticulously machined parts laid out on a clean workbench. It is calm, authoritative, and professional.

---

## 2. Colors: Tonal Sophistication
Our palette moves away from stark digital blacks and whites. We utilize a "Slate and Stone" foundation to ground the user in a tactile, mechanical world.

### The Palette
- **Primary (`#485e8d`):** A refined indigo. Use this sparingly for intent and direction, never for decoration.
- **Surface Foundations:** 
    - `surface`: `#f7f9fb` (The base canvas)
    - `surface_container_low`: `#f0f4f7` (Secondary sections)
    - `surface_container_lowest`: `#ffffff` (Floating interactive elements)
- **Typography:** 
    - `on_surface`: `#2a3439` (Deep slate for maximum legibility)
    - `on_surface_variant`: `#566166` (Subdued metadata)

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off content. Boundaries must be defined solely through background color shifts. To separate a list from a background, place a `surface_container_lowest` card atop a `surface_container_low` section. Let the change in value do the work.

### Signature Textures
While the atmosphere is "Quiet," we avoid flatness. For primary Call-to-Actions (CTAs), use a subtle tonal transition from `primary` (#485e8d) to `primary_dim` (#3c5280). This provides a "weighted" feel to buttons, mimicking the density of high-quality components.

---

## 3. Typography: Editorial Authority
The type system pairs **Manrope** (Display/Headline) with **Inter** (Body/Labels). Manrope’s geometric yet open structure provides a technical "machined" look for titles, while Inter provides the neutral legibility required for dense maintenance logs.

- **Display & Headlines (Manrope):** Use `display-md` (2.75rem) for main dashboard headers. The high contrast between large headers and small metadata creates an "Editorial" hierarchy.
- **Body & Titles (Inter):** `body-md` (0.875rem) is our workhorse. Ensure `line-height` is set to 1.5x for readability in technical descriptions.
- **The Metadata Lockup:** Always pair `title-sm` (Inter, Bold) with a trailing or sub-positioned `label-md` (Inter, Regular, `on_surface_variant`). This "High-Low" pairing communicates technical sophistication.

---

## 4. Elevation & Depth: Tonal Layering
We do not use shadows to create "pop." We use them to create **presence**.

- **The Layering Principle:** Depth is achieved by stacking. A typical view should follow this hierarchy:
    1.  **Level 0:** `surface` (The App Background)
    2.  **Level 1:** `surface_container_low` (Section groupings/content areas)
    3.  **Level 2:** `surface_container_lowest` (Interactive cards/input fields)
- **Ambient Shadows:** For floating elements (like a "Start Ride" FAB), use a highly diffused shadow: `y: 8px, blur: 24px, color: rgba(42, 52, 57, 0.06)`. This mimics soft, ambient garage lighting.
- **Glassmorphism:** For top navigation bars or sticky mobile headers, use `surface` at 85% opacity with a `20px backdrop-blur`. This allows the "machinery" of the app to scroll beneath the interface, maintaining a sense of space.

---

## 5. Components: The Primitive Set

### Buttons & Interaction
- **Primary Button:** Rounded at `md` (0.75rem). Background: `primary`. Text: `on_primary` (Uppercase, 0.75rem, tracking 0.05em for a technical feel).
- **Secondary Button:** `surface_container_highest` background with `on_surface` text. No border.
- **Ghost Border Fallback:** If a button must exist on a complex background, use the `outline_variant` at **20% opacity**.

### Input Fields
- **Container:** `surface_container_low` with a bottom-only "active" indicator in `primary`.
- **Corner Radius:** `sm` (0.25rem) for a more precise, technical appearance compared to the softer `md` used for cards.

### Cards & Lists
- **The Divider Ban:** Never use a horizontal line to separate list items. Use 16px of vertical space or a `surface` alternating "zebra" striping if density is extremely high.
- **Nesting:** Place `surface_container_highest` chips inside `surface_container_lowest` cards to denote status (e.g., "Service Overdue" using `error_container`).

### Context-Specific Components
- **The Part-Spec Chip:** For motorcycle specs (e.g., "Torque: 105 Nm"), use a `surface_variant` background with a `label-sm` font. This keeps technical data compact and "quiet."
- **The Maintenance Timeline:** A vertical track using `outline_variant` at 40% opacity, with `primary` nodes for completed tasks.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use `surface_container_low` to group related maintenance items.
*   **Do** use `manrope` for numbers. Its geometric nature feels like a digital odometer.
*   **Do** embrace white space. If a screen feels "empty," it is working.
*   **Do** use `8-12px` (the `md` scale) for all main container corners.

### Don't
*   **Don't** use pure black (#000000). Use `on_surface` for text and `inverse_surface` for dark modes.
*   **Don't** use 1px dividers. If you feel you need one, try a 4px gap or a color shift first.
*   **Don't** use "vibrant" colors for anything other than semantic status (Success/Error). 
*   **Don't** use heavy dropshadows. If the elevation isn't clear through color, the layout needs more breathing room.

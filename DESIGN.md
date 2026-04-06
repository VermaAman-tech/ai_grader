# Design System Document

## 1. Overview & Creative North Star: The Digital Scholar
The "Digital Scholar" is the creative north star of this design system. It moves away from the sterile, modular appearance of standard "SaaS" platforms and instead adopts the gravitas of a high-end academic journal or a premium editorial publication. 

The goal is to foster an environment of deep focus and unquestionable authority. This is achieved through **Structured Asymmetry**—where layouts are balanced but not perfectly mirrored—and **Tonal Depth**, using layers of color rather than lines to organize information. We prioritize readability and intellectual rigor, ensuring that the interface never distracts from the content but rather frames it as significant.

---

## 2. Color & Surface Philosophy

This design system utilizes a sophisticated palette of ink-like blues, clinical grays, and parchment whites to establish a "Trustworthy Academic" aesthetic.

### The "No-Line" Rule
To achieve a bespoke, premium feel, **1px solid borders are prohibited for sectioning.** Boundaries must be defined through background color shifts. For example, a sidebar should be rendered in `surface_container_low` against a `surface` main content area. This creates a softer, more integrated visual flow that feels modern and intentional.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of academic papers. Use the Surface tiers to create a logical "nesting" of information:
- **Base Layer:** `surface` (#f6faff) for the main application background.
- **Sectioning:** `surface_container` (#e6eff8) for sidebars or secondary content regions.
- **Content Cards:** `surface_container_lowest` (#ffffff) to provide a crisp, high-contrast area for reading text.
- **Interaction Layers:** `surface_container_high` (#e0e9f2) for hovered or active states within a container.

### The "Glass & Gradient" Rule
Flatness is the enemy of premium design. 
- **Signature Textures:** For primary CTAs or high-level headers, use a subtle linear gradient transitioning from `primary` (#001a3a) to `primary_container` (#002f5f) at a 135-degree angle. This adds a "weighted" feel to the element.
- **Glassmorphism:** Floating panels (like tooltips or dropdowns) should use `surface_container_low` at 80% opacity with a `20px` backdrop-blur. This ensures the background color bleeds through, making the UI feel like a singular, cohesive organism.

---

## 3. Typography: Editorial Authority

The typography system pairs **Public Sans** for display and headlines with **Inter** for utility and body text. This creates a hierarchy that feels both modern and historically grounded.

- **Display & Headlines (Public Sans):** Used to announce sections and key data. Use `display-lg` (3.5rem) with tighter letter-spacing (-0.02em) for an editorial impact.
- **Body & Labels (Inter):** Optimized for long-form reading and data density. `body-md` (0.875rem) is our workhorse. Ensure a line-height of at least 1.6 for body text to maintain "academic" breathing room.
- **Monospace Influence:** Use a monospace font for document metadata, word counts, or citation IDs to lean into the technical nature of educational verification.

---

## 4. Elevation & Depth: Tonal Layering

Traditional shadows are often too "heavy" for an academic context. We prefer **Ambient Shadows** and **Tonal Layering**.

- **The Layering Principle:** Place a `surface_container_lowest` card on a `surface_container_low` background. This creates a "soft lift" that is perceptible but not jarring.
- **Ambient Shadows:** When an element must float (e.g., a modal), use a high-spread, low-opacity shadow. 
    - *Example:* `0px 12px 32px rgba(20, 29, 35, 0.06)`. The shadow color should be a tinted version of `on_surface` to mimic natural light.
- **The "Ghost Border" Fallback:** If a divider is functionally required (e.g., in a complex data table), use a "Ghost Border." Use `outline_variant` at 15% opacity. Never use 100% opaque lines.

---

## 5. Components

### Buttons
- **Primary:** Gradient fill (`primary` to `primary_container`), white text, `md` (0.375rem) roundedness.
- **Secondary:** `surface_container_high` background with `on_surface` text. No border.
- **Tertiary:** Purely typographic using `primary` color, with a subtle `surface_container` background appearing only on hover.

### Data Tables (The Academic Grid)
- **Rows:** Forbid horizontal lines. Distinguish rows using a subtle `surface_container_low` stripe on every second row (zebra striping).
- **Header:** `surface_container_highest` background with `label-md` uppercase text.
- **Cell Padding:** Generous vertical padding (16px+) to ensure the data feels "curated" rather than "crammed."

### Input Fields
- **Container:** Use `surface_container_low` for the input background.
- **Active State:** Instead of a heavy border, use a 2px "Ghost Border" of `primary` at 40% opacity and a subtle `surface_tint` inner glow.
- **Error State:** Use `error` (#ba1a1a) for the label text and a `error_container` background for the input itself.

### Chips & Badges
- **Status Chips:** Use high-chroma variants like `tertiary_container` for "High Similarity" or `primary_fixed` for "Verified." Always use `9999px` (full) roundedness for chips to contrast against the more structured `md` corners of the layout.

---

## 6. Do’s and Don’ts

### Do
- **Do** use whitespace as a functional tool to separate ideas.
- **Do** use `title-lg` for card headers to establish a clear information hierarchy.
- **Do** leverage "surface nesting" to group related form elements without using boxes-within-boxes.
- **Do** ensure all interactive elements have a clear `surface_variant` state change on hover.

### Don't
- **Don't** use pure black (#000000) for text. Use `on_surface` (#141d23) to reduce eye strain.
- **Don't** use 1px solid borders for any decorative or structural purpose.
- **Don't** use standard drop shadows with high opacity; keep them "ambient" and tinted.
- **Don't** use more than two different font families. Stick to the pairing of Public Sans and Inter.
---
name: Editorial Compliance & Review Desk
colors:
  surface: '#f8f9fc'
  surface-dim: '#d8dadd'
  surface-bright: '#f8f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e7e8eb'
  surface-container-highest: '#e1e2e5'
  on-surface: '#191c1e'
  on-surface-variant: '#404945'
  inverse-surface: '#2e3133'
  inverse-on-surface: '#eff1f3'
  outline: '#717975'
  outline-variant: '#c0c8c4'
  surface-tint: '#396759'
  primary: '#00362a'
  on-primary: '#ffffff'
  primary-container: '#1e4d40'
  on-primary-container: '#8dbdac'
  inverse-primary: '#a0d1bf'
  secondary: '#236958'
  on-secondary: '#ffffff'
  secondary-container: '#a9eed7'
  on-secondary-container: '#296e5c'
  tertiary: '#10352b'
  on-tertiary: '#ffffff'
  tertiary-container: '#284c41'
  on-tertiary-container: '#95bbad'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bceddb'
  primary-fixed-dim: '#a0d1bf'
  on-primary-fixed: '#002018'
  on-primary-fixed-variant: '#204f42'
  secondary-fixed: '#abf0da'
  secondary-fixed-dim: '#90d4be'
  on-secondary-fixed: '#002019'
  on-secondary-fixed-variant: '#005141'
  tertiary-fixed: '#c3ebdc'
  tertiary-fixed-dim: '#a8cfc0'
  on-tertiary-fixed: '#002018'
  on-tertiary-fixed-variant: '#2a4d43'
  background: '#f8f9fc'
  on-background: '#191c1e'
  surface-variant: '#e1e2e5'
typography:
  display-hero:
    fontFamily: Newsreader
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 56px
  display-hero-mobile:
    fontFamily: Newsreader
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
  headline-lg:
    fontFamily: Newsreader
    fontSize: 32px
    fontWeight: '500'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Newsreader
    fontSize: 26px
    fontWeight: '500'
    lineHeight: 34px
  headline-md:
    fontFamily: Newsreader
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  headline-sm:
    fontFamily: Newsreader
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  title-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
  code-sm:
    fontFamily: Courier Prime
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 0.75rem
  gutter-lg: 2rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system targets brand directors, legal counsel, and creative marketing leads overseeing global campaign compliance. The emotional atmosphere balances the rigorous authority of an archival review board with the effortless frictionlessness of modern collaborative SaaS.

### Personality & Values
- **Authoritative & Dispassionate:** Delivers scrutiny without hostility. Information architecture prioritizes verifiable facts, legal certitude, and precise line-item feedback.
- **Editorial & Curated:** Avoids sterile technical chrome. Interfaces resemble heavy-stock publication proofs and tactile galley sheets rather than disposable dashboard grids.
- **Decisive Clarity:** High-contrast information anchors guide rapid triage, preventing review fatigue across thousands of visual and textual campaign assets.

### Aesthetic Direction: Modern Editorial Tactile
The aesthetic unites literary publishing conventions with modern software ergonomics:
- **Tonal Substrates:** Calibrated warm stone, paper, and off-white backdrops that eliminate eye fatigue caused by harsh blue-white screens.
- **Literary Accents:** High-character serif headings for operational titles and campaign identifiers, paired with crisp neutral grotesques for data density and UI controls.
- **Crisp Structural Framing:** Paper-thin hairline boundaries and warm, tinted micro-drop shadows reminiscent of physical card stock and contact sheets.

## Colors

The palette establishes an architectural hierarchy using warm mineral neutrals, deep forest brand accents, and precise semantic signifiers.

### Surface Hierarchy
- **Canvas Base:** `#F9F8F6` (Parchment white) serves as the ambient environment for background viewports.
- **Layered Wells & Sidebars:** `#F2EFEB` (Milled stone) structures utility panels, sidebars, and document drawers.
- **Interactive Planes & Proof Cards:** `#FFFFFF` (Pure editorial stock) provides elevation for cards, active document stages, and contextual inspector dialogs.
- **Hairline Dividers:** `#E5E1DA` (Warm border) demarcates zones without introducing harsh visual stops.

### Text & Ink Systems
- **Ink Primary:** `#191C1E` (Carbon Black) for primary readings, legal text, and structural headlines.
- **Ink Secondary:** `#2D3133` (Graphite) for labels, metadata, secondary body, and table headers.
- **Ink Tertiary / Muted:** `#636769` for deactivated indicators, breadcrumb separators, and timestamps.

### Brand & Operational Tokens
- **Brand Primary:** `#1E4D40` (Forest Ink) marks primary confirmation flows, brand badges, and verified asset states.
- **Brand Accent / Hover:** `#2A6F5D` (Lichen Teal) handles interactive hover transitions and tab highlights.
- **Brand Pressed / Deep:** `#13382E` (Deep Canopy) reserves for pressed CTA states and high-emphasis anchors.

### Semantic Triage Tokens
- **Critical / Violation:** Base `#C93B2B`, Surface `#FDF2F1`, Stroke `#F8B4AD` (OCR bounding box failure, legal claim violations).
- **Warning / Caution:** Base `#D97706`, Surface `#FFFBEB`, Stroke `#FDE68A` (Unlicensed typography, regional disclosure warnings).
- **Info / Notice:** Base `#2563EB`, Surface `#EFF6FF`, Stroke `#BFDBFE` (Metadata mismatches, localization suggestions).
- **Approved / Resolved:** Base `#15803D`, Surface `#F0FDF4`, Stroke `#BBF7D0` (Compliant runs, cleared assets).

## Typography

The typography system couples the deliberate gravity of an editorial serif (`Newsreader`) with the mechanical precision and neutral legibility of `Plus Jakarta Sans`.

### Typographic Hierarchy & Pairing
- **Serif Role (`Newsreader`):** Used exclusively for editorial narrative anchors—campaign titles, compliance summary briefs, review status headlines, and modal headers. Employs normal to medium weights with optical sizing enabled (`opsz` 36–72) to highlight crisp serifs and warm stroke contrast.
- **Sans-Serif Role (`Plus Jakarta Sans`):** Dictates all operational UI, data density tables, inspection panel forms, annotations, and system notifications. Its geometry prevents fatigue during sustained cross-referencing.
- **Monospace Role (`Courier Prime`):** Applied strictly to OCR output strings, bounding coordinates, raw legal token variables, and hex color verification readouts.

### Scaling & Legibility Directives
- Headings scale smoothly down to compact line-heights on smaller screens (`display-hero-mobile`, `headline-lg-mobile`) to prevent multiline wrapping from dominating vertical real estate.
- All body types maintain an open `1.5` to `1.6` line-height ratio to preserve legibility when displaying dense compliance clauses and regulatory disclaimers side by side with visual assets.

## Layout & Spacing

The workspace implements an adaptive multi-pane editorial layout engineered for intensive split-screen document appraisal.

### Layout Model
- **Desktop (1440px+):** Tri-pane workstation framework. 
  1. *Navigation/Manifest Column:* Fixed width at `280px` (`#F2EFEB`).
  2. *Artboard Stage (Inspection Viewport):* Fluid center panel containing pan/zoom visual proofs and containerized preview nodes.
  3. *Audit & Policy Inspector:* Fixed width at `380px` (`#FFFFFF`), housing line-item violations, rule matches, and approval signoffs.
- **Tablet (768px – 1023px):** Dual-pane view with a collapsible navigation drawer. Inspector becomes an overlay or slides below the canvas.
- **Mobile (< 768px):** Single-column stacked mode. Artwork viewport locks to 16:9 or 1:1 aspect containers; compliance reports collapse into bottom sheets.

### Spacing Rules
- Visual density follows an 8pt modular grid. 
- Form elements, list items, and bounding box tag nodes rely strictly on `space-sm` (8px) and `space-md` (16px) for interior containment.
- Margin cushions between unrelated document segments scale to `space-xl` (40px) to establish confident visual breathability.

## Elevation & Depth

Visual depth avoids excessive blur radii, relying instead on physical paper stacking metaphors, tinted ambient drops, and crisp surface borders.

### Surface Tiers & Depth
- **Level 0 (Floor Canvas):** Flat `#F9F8F6` base; zero elevation.
- **Level 1 (Substrate & Well):** `#F2EFEB` inset with a `1px solid #E5E1DA` boundary. Used for document stages and filter bars.
- **Level 2 (Paper Sheet & Cards):** `#FFFFFF` surface bordered with `1px solid #E5E1DA`. Shadow is warm and physical: `0 1px 3px rgba(25, 28, 30, 0.04), 0 2px 8px rgba(25, 28, 30, 0.02)`.
- **Level 3 (Inspector Drawers & Overlays):** `#FFFFFF` surfaces with `1px solid #E5E1DA` and a distinct drop: `0 8px 24px -4px rgba(25, 28, 30, 0.08), 0 2px 6px -1px rgba(25, 28, 30, 0.04)`.
- **Level 4 (Floating Contextual Menus & OCR Pins):** `#FFFFFF` accompanied by an accent boundary: `0 12px 32px -4px rgba(30, 77, 64, 0.12), 0 4px 12px rgba(25, 28, 30, 0.06)`.

### Tactile Boundary Doctrine
No shadow exists without an accompanying enclosing hairline stroke (`1px solid #E5E1DA`). This guarantees structural contrast when rendering bright asset previews and high-key creative photography.

## Shapes

The interface embraces a restrained geometric curvature level (`0.25rem` base, `roundedness: 1`), evoking tailored stationery, card-mounted slides, and precision technical tools.

### Curvature Taxonomy
- **Standard Controls & Tags (0.25rem / 4px):** Buttons, text inputs, status chips, segmented pickers, and checkbox boxes. Provides crisp, architectural corners.
- **Cards, Drawers & Canvases (0.5rem / 8px):** Asset cards, modal containers, and side inspection docks.
- **Pill Exceptions (9999px):** Restricted solely to micro-metric badges, unread counter counts, and active annotation pen toggles.

## Components

### Buttons
- **Primary:** Background `#1E4D40`, text `#FFFFFF`, border none, shadow `0 1px 2px rgba(19, 56, 46, 0.2)`. Hover `#2A6F5D`; active `#13382E`. Border radius `4px`. Height `40px` for standard desk actions; `32px` for compact header actions.
- **Secondary / Outline:** Background `#FFFFFF`, text `#191C1E`, border `1px solid #E5E1DA`. Hover background `#F9F8F6`, border `#191C1E`.
- **Ghost:** Text `#2D3133`, hover background `#F2EFEB`.
- **Destructive:** Background `#FDF2F1`, text `#C93B2B`, border `1px solid #F8B4AD`. Hover background `#C93B2B`, hover text `#FFFFFF`.

### Chips & Badges
- **Editorial Severity Badges:**
  - *Critical:* Background `#FDF2F1`, text `#C93B2B`, border `1px solid #F8B4AD`.
  - *Warning:* Background `#FFFBEB`, text `#D97706`, border `1px solid #FDE68A`.
  - *Info:* Background `#EFF6FF`, text `#2563EB`, border `1px solid #BFDBFE`.
  - *Resolved:* Background `#F0FDF4`, text `#15803D`, border `1px solid #BBF7D0`.
- Padding: `2px 8px`, font size `11px`, font weight `600`, radius `4px`. Monospaced numeral prefixes for defect counts (e.g., `[03] VIOLATION`).

### Form Inputs & Selectors
- **Text Inputs:** Background `#FFFFFF`, border `1px solid #E5E1DA`, text `#191C1E`, radius `4px`, padding `10px 12px`. Focus state applies `1px solid #1E4D40` and an outward halo `0 0 0 3px rgba(30, 77, 64, 0.12)`.
- **Checkboxes & Radios:** `18px × 18px`. Border `1.5px solid #2D3133`, background `#FFFFFF`, radius `3px`. Checked state: background `#1E4D40`, white checkmark icon.

### Cards & Asset Proof Tiles
- **Artwork Preview Tile:** Surface `#FFFFFF`, border `1px solid #E5E1DA`, radius `8px`. Image viewport inset with subtle check checkerboard background for transparency evaluation. Lower metadata tray uses typography `title-sm` with a right-aligned review state chip.

### OCR Bounding Box & Canvas Annotations
- **Bounding Overlays:** Absolute positioned box on artwork stage. Border `1.5px dashed` or `2px solid` mapped directly to severity colors (e.g., `#C93B2B` for legal claim breach).
- **Target Tag Pin:** Floating pill anchored to top-left of the bounding box: `#191C1E` background, white monospaced coordinate text (`Courier Prime`, 10px), accompanied by a quick-action drawer trigger icon.
- **Selected State:** Fill opacity `rgba(201, 59, 43, 0.08)` to clearly isolate targeted visual areas without occluding underlying campaign copy.

### Inspection Lists & Rule Logs
- Divided horizontal items using `#E5E1DA` borders. Each item features an inline severity indicator, policy reference link (`Newsreader` italic, 13px), and quick-action resolution buttons.
# PFY — Design Tokens v1

**Brand:** Portuguese for You  
**Version:** 1.0  
**Status:** IMPLEMENTATION FOUNDATION  
**Parent:** `resources/brand/BRAND-SYSTEM.md`

---

## 1. Purpose

This document translates the approved PFY visual direction into reusable design primitives and semantic tokens for the digital product.

It defines the initial implementation foundation for:

- color;
- typography;
- spacing;
- sizing;
- border radius;
- borders;
- shadows;
- responsive breakpoints;
- focus states;
- motion;
- accessibility.

These tokens should be used by PFY product interfaces rather than hard-coded visual values inside individual components.

---

# 2. Token Architecture

PFY uses three conceptual layers:

```text
Brand Direction
      ↓
Primitive Tokens
      ↓
Semantic Tokens
      ↓
Components
```

Example:

```text
brand.coral.500
      ↓
action.primary.background
      ↓
Button / Primary
```

Components should generally consume **semantic tokens**, not primitive colors directly.

This allows accessibility or visual adjustments without redefining the brand.

---

# 3. Naming Convention

Recommended structure:

```text
category.role.variant.state
```

Examples:

```text
color.text.primary
color.background.canvas
color.action.primary.default
color.action.primary.hover

space.4
radius.md
shadow.sm

font.family.brand
font.family.product
```

Implementation syntax may vary depending on the frontend stack.

The semantic meaning should remain stable.

---

# 4. Primitive Color Palette

The following colors establish the starting PFY palette.

## 4.1 Deep Blue

```text
brand.blue.50    #F1F6F9
brand.blue.100   #DDEAF1
brand.blue.200   #BDD6E3
brand.blue.300   #91B9CC
brand.blue.400   #5E94AE
brand.blue.500   #356F8C
brand.blue.600   #255873
brand.blue.700   #1D4860
brand.blue.800   #173B57
brand.blue.900   #102D43
brand.blue.950   #091C2B
```

Canonical brand reference:

```text
brand.blue.800 = #173B57
```

---

# 5. Coral

```text
brand.coral.50    #FFF3F0
brand.coral.100   #FFE1DA
brand.coral.200   #FFC6BA
brand.coral.300   #FFA18F
brand.coral.400   #FA806D
brand.coral.500   #F26B5E
brand.coral.600   #DE5148
brand.coral.700   #BB3F39
brand.coral.800   #993733
brand.coral.900   #7F3330
brand.coral.950   #451715
```

Canonical brand reference:

```text
brand.coral.500 = #F26B5E
```

Coral is the primary expressive brand accent.

It must not automatically represent errors.

---

# 6. Terracotta

```text
brand.terracotta.50    #FDF6F1
brand.terracotta.100   #F9E8DC
brand.terracotta.200   #F2CEB7
brand.terracotta.300   #E9AF8B
brand.terracotta.400   #E0966D
brand.terracotta.500   #D98C5F
brand.terracotta.600   #C36E45
brand.terracotta.700   #A25438
brand.terracotta.800   #854531
brand.terracotta.900   #6D3B2C
```

Canonical reference:

```text
brand.terracotta.500 = #D98C5F
```

---

# 7. Solar Yellow

```text
brand.yellow.50    #FFFAE8
brand.yellow.100   #FFF2C3
brand.yellow.200   #FFE487
brand.yellow.300   #FFD34B
brand.yellow.400   #F8C737
brand.yellow.500   #F2C94C
brand.yellow.600   #D9A91F
brand.yellow.700   #B48218
brand.yellow.800   #91651B
brand.yellow.900   #77531C
```

Canonical reference:

```text
brand.yellow.500 = #F2C94C
```

Yellow must not automatically represent warning states.

---

# 8. Light Blue

```text
brand.sky.50    #F5FAFE
brand.sky.100   #EAF5FC
brand.sky.200   #CFE7F8
brand.sky.300   #AED7F2
brand.sky.400   #7FC0E9
brand.sky.500   #55A5DC
brand.sky.600   #3988C1
brand.sky.700   #306EA0
brand.sky.800   #2B5D84
brand.sky.900   #294F6E
```

Canonical reference:

```text
brand.sky.200 = #CFE7F8
```

---

# 9. Warm Neutrals

## Cream

```text
neutral.cream = #FAF7F2
```

## White

```text
neutral.white = #FFFFFF
```

## Gray scale

```text
neutral.50    #F8F9FA
neutral.100   #F1F3F4
neutral.200   #E5E7EB
neutral.300   #D1D5DB
neutral.400   #9CA3AF
neutral.500   #6B7280
neutral.600   #4B5563
neutral.700   #374151
neutral.800   #252D35
neutral.900   #172026
neutral.950   #0D1318
```

Primary graphite:

```text
neutral.900 = #172026
```

---

# 10. Semantic Background Tokens

```text
color.background.canvas       = neutral.cream
color.background.product      = neutral.50
color.background.surface      = neutral.white
color.background.subtle       = neutral.100
color.background.brand        = brand.blue.800
color.background.brand-soft   = brand.blue.50
color.background.accent-soft  = brand.coral.50
color.background.info-soft    = brand.sky.100
```

Recommended behavior:

### Marketing surfaces

Prefer:

```text
neutral.cream
neutral.white
brand.blue.800
```

with more expressive accent usage.

### Product surfaces

Prefer:

```text
neutral.50
neutral.white
```

with brand colors used selectively.

---

# 11. Semantic Text Tokens

```text
color.text.primary       = neutral.900
color.text.secondary     = neutral.600
color.text.tertiary      = neutral.500
color.text.disabled      = neutral.400

color.text.brand         = brand.blue.800
color.text.on-brand      = neutral.white
color.text.link          = brand.blue.700
```

Body text should normally use graphite rather than Deep Blue.

This prevents excessive brand coloration across information-dense screens.

---

# 12. Primary Actions

Coral is the primary expressive action color.

Initial mapping:

```text
color.action.primary.default     = brand.coral.600
color.action.primary.hover       = brand.coral.700
color.action.primary.active      = brand.coral.800
color.action.primary.text        = neutral.white
color.action.primary.disabled    = neutral.200
```

Notice that the default product action uses:

```text
brand.coral.600
```

rather than the canonical:

```text
brand.coral.500
```

This provides additional contrast flexibility while preserving the coral identity.

Final combinations must be verified against WCAG requirements during implementation.

---

# 13. Secondary Actions

```text
color.action.secondary.background = neutral.white
color.action.secondary.text       = brand.blue.800
color.action.secondary.border     = brand.blue.300

color.action.secondary.hover      = brand.blue.50
color.action.secondary.active     = brand.blue.100
```

---

# 14. Tertiary Actions

```text
color.action.tertiary.background = transparent
color.action.tertiary.text       = brand.blue.700
color.action.tertiary.hover      = brand.blue.50
```

---

# 15. Links

```text
color.link.default = brand.blue.700
color.link.hover   = brand.blue.900
color.link.visited = brand.blue.800
```

Links must not depend solely on color when context makes them difficult to distinguish from regular text.

Underline should be used where necessary.

---

# 16. Semantic Status Colors

Product states must remain independent from brand semantics.

Initial status palette:

```text
status.success.background
status.success.surface
status.success.text
status.success.border

status.warning.background
status.warning.surface
status.warning.text
status.warning.border

status.error.background
status.error.surface
status.error.text
status.error.border

status.info.background
status.info.surface
status.info.text
status.info.border
```

Exact production values should be selected through accessibility validation.

Do not map:

```text
coral → error
yellow → warning
```

simply because the colors appear visually similar.

---

# 17. Borders

```text
color.border.default = neutral.200
color.border.strong  = neutral.300
color.border.brand   = brand.blue.300
```

Recommended widths:

```text
border.width.none = 0
border.width.sm   = 1px
border.width.md   = 2px
```

Most product surfaces should use subtle borders rather than strong shadows.

---

# 18. Typography Families

## Brand / Editorial

```text
font.family.brand = "Lora", Georgia, serif
```

## Product / Interface

```text
font.family.product =
  "Plus Jakarta Sans",
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif
```

---

# 19. Typography Scale

Recommended initial scale:

```text
font.size.xs    = 12px
font.size.sm    = 14px
font.size.md    = 16px
font.size.lg    = 18px
font.size.xl    = 20px
font.size.2xl   = 24px
font.size.3xl   = 30px
font.size.4xl   = 36px
font.size.5xl   = 48px
font.size.6xl   = 60px
```

---

# 20. Product Typography Roles

## Caption

```text
font.caption:
size        12px
line-height 16px
weight      500
```

## Label

```text
font.label:
size        14px
line-height 20px
weight      600
```

## Body Small

```text
font.body.sm:
size        14px
line-height 21px
weight      400
```

## Body

```text
font.body.md:
size        16px
line-height 24px
weight      400
```

## Body Large

```text
font.body.lg:
size        18px
line-height 28px
weight      400
```

## Product Heading Small

```text
font.heading.sm:
size        20px
line-height 28px
weight      700
```

## Product Heading Medium

```text
font.heading.md:
size        24px
line-height 32px
weight      700
```

## Product Heading Large

```text
font.heading.lg:
size        30px
line-height 38px
weight      700
```

Product headings use:

```text
font.family.product
```

unless a deliberately editorial context exists.

---

# 21. Editorial Typography Roles

## Editorial Heading Small

```text
font.editorial.sm:
family      brand
size        30px
line-height 38px
weight      600
```

## Editorial Heading Medium

```text
font.editorial.md:
family      brand
size        40px
line-height 48px
weight      600
```

## Editorial Heading Large

```text
font.editorial.lg:
family      brand
size        52px
line-height 60px
weight      600
```

## Hero

```text
font.editorial.hero:
family      brand
size        64px
line-height 68px
weight      600
```

Hero typography must scale responsively rather than remain fixed at 64px.

---

# 22. Font Weights

Recommended:

```text
font.weight.regular   = 400
font.weight.medium    = 500
font.weight.semibold  = 600
font.weight.bold      = 700
```

Avoid excessive use of bold weights.

Hierarchy should come from:

- size;
- spacing;
- contrast;
- position;

as well as weight.

---

# 23. Spacing System

PFY uses a 4px base spacing grid.

```text
space.0   = 0
space.1   = 4px
space.2   = 8px
space.3   = 12px
space.4   = 16px
space.5   = 20px
space.6   = 24px
space.8   = 32px
space.10  = 40px
space.12  = 48px
space.16  = 64px
space.20  = 80px
space.24  = 96px
space.32  = 128px
```

Prefer tokens over arbitrary values such as:

```text
17px
23px
37px
```

unless there is a documented visual requirement.

---

# 24. Component Density

PFY should favor comfortable rather than extremely compact UI.

Typical internal component padding:

```text
compact     8–12px
default     12–16px
comfortable 16–24px
```

Administrative tables and reporting surfaces may require denser layouts.

Density should reflect the task rather than brand expression.

---

# 25. Border Radius

Initial radius system:

```text
radius.none = 0
radius.xs   = 4px
radius.sm   = 8px
radius.md   = 12px
radius.lg   = 16px
radius.xl   = 24px
radius.full = 9999px
```

Recommended defaults:

```text
Button        radius.sm
Input         radius.sm
Card          radius.md
Large card    radius.lg
Badge         radius.full
Avatar        radius.full
```

Avoid making every surface heavily rounded.

The product should feel warm without becoming visually childish.

---

# 26. Shadows

Shadows should remain subtle.

```text
shadow.none = none

shadow.xs =
0 1px 2px rgb(23 32 38 / 0.05)

shadow.sm =
0 2px 6px rgb(23 32 38 / 0.07)

shadow.md =
0 8px 20px rgb(23 32 38 / 0.09)

shadow.lg =
0 16px 40px rgb(23 32 38 / 0.12)
```

Use borders before shadows when hierarchy can be achieved without elevation.

---

# 27. Elevation

Recommended conceptual levels:

```text
elevation.0 = page
elevation.1 = card
elevation.2 = dropdown / floating controls
elevation.3 = modal
elevation.4 = critical overlay
```

Elevation must communicate hierarchy, not decoration.

---

# 28. Layout Width

Recommended content containers:

```text
layout.content.sm = 640px
layout.content.md = 768px
layout.content.lg = 1024px
layout.content.xl = 1200px
layout.content.2xl = 1440px
```

Marketing pages may use wider compositions.

Learning content should generally preserve comfortable reading widths.

---

# 29. Responsive Breakpoints

Initial breakpoint model:

```text
breakpoint.sm   = 640px
breakpoint.md   = 768px
breakpoint.lg   = 1024px
breakpoint.xl   = 1280px
breakpoint.2xl  = 1536px
```

These are implementation foundations rather than guarantees of a specific device category.

Components should respond to available space rather than depend exclusively on named device types.

---

# 30. Touch Targets

Interactive controls should target a minimum effective area of:

```text
44 × 44px
```

especially on touch interfaces.

Small icons may visually occupy less space while retaining an adequate interactive target.

---

# 31. Form Controls

Recommended control heights:

```text
control.sm = 36px
control.md = 44px
control.lg = 52px
```

Default:

```text
control.md
```

Form controls should provide distinct states for:

- default;
- hover;
- focus;
- filled;
- disabled;
- invalid;
- valid where useful.

---

# 32. Focus

Keyboard focus must always be visible.

Recommended conceptual token:

```text
focus.ring.width  = 3px
focus.ring.offset = 2px
focus.ring.color  = brand.sky.500
```

The final focus color must meet visibility requirements against supported backgrounds.

Never remove browser focus indicators without supplying an accessible replacement.

---

# 33. Motion

Recommended durations:

```text
motion.duration.fast    = 120ms
motion.duration.normal  = 200ms
motion.duration.slow    = 320ms
```

Recommended easing:

```text
motion.ease.standard
motion.ease.enter
motion.ease.exit
```

Exact cubic-bezier values may be defined during component implementation.

---

# 34. Motion Principles

Motion should communicate:

- state change;
- hierarchy;
- continuity;
- progress;
- feedback.

The PFY wave may inspire movement but should not cause continuous decorative animation.

Respect:

```css
prefers-reduced-motion
```

for non-essential movement.

---

# 35. Icon Sizes

```text
icon.xs = 14px
icon.sm = 16px
icon.md = 20px
icon.lg = 24px
icon.xl = 32px
```

Default product icon:

```text
icon.md
```

Navigation may commonly use:

```text
icon.lg
```

depending on density.

---

# 36. Avatars

Recommended sizes:

```text
avatar.xs = 24px
avatar.sm = 32px
avatar.md = 40px
avatar.lg = 48px
avatar.xl = 64px
```

---

# 37. Product Surface Strategy

The product should remain visually calmer than marketing surfaces.

Recommended ratio:

### Product UI

Approximately:

```text
70–85% neutral surfaces
10–20% structural brand color
5–10% expressive accent
```

This is a visual guideline, not a mathematical acceptance criterion.

---

# 38. Marketing Surface Strategy

Marketing may use stronger combinations of:

```text
Deep Blue
Coral
Terracotta
Solar Yellow
Light Blue
Cream
Photography
PFY Wave
```

Marketing pages should still preserve hierarchy and whitespace.

---

# 39. Data Visualization

Charts must not automatically reuse the marketing palette without considering interpretation.

Chart tokens should eventually define:

```text
data.series.1
data.series.2
data.series.3
data.series.4
data.series.5

data.positive
data.negative
data.neutral
data.highlight
```

Data visualization must consider:

- color-blind accessibility;
- sufficient contrast;
- labels;
- patterns or shapes where necessary;
- semantic consistency.

Exact chart colors remain pending.

---

# 40. Activity States

Learning activities will require semantic states such as:

```text
activity.not-started
activity.in-progress
activity.completed
activity.review
activity.locked
```

These states must use more than color alone.

Recommended supporting signals include:

- icon;
- label;
- progress indicator;
- text.

Exact styling should be defined with the learning experience.

---

# 41. Progress

Progress indicators may use brand colors when they represent neutral progression.

Example conceptual mapping:

```text
progress.track = neutral.200
progress.value = brand.blue.600
```

Coral may be used for selected high-emphasis progress moments but should not become the default if it creates excessive visual competition.

---

# 42. Accessibility Requirements

Production components must target WCAG AA as the baseline.

At minimum:

### Normal text

Target contrast:

```text
4.5:1
```

### Large text

Target contrast:

```text
3:1
```

### Meaningful UI components

Target contrast:

```text
3:1
```

where applicable.

Accessibility validation must include actual component combinations rather than checking colors in isolation.

---

# 43. Color Independence

No important information may be communicated by color alone.

Incorrect:

```text
red = wrong
green = correct
```

without another signal.

Preferred:

```text
icon + label + color
```

Example:

```text
✓ Concluído
```

---

# 44. Dark Mode

Dark mode is **not part of Design System v1**.

Do not automatically derive a dark theme from these tokens.

If dark mode becomes a product requirement, it should receive its own semantic-token validation.

---

# 45. Component Token Layer

Components may introduce local semantic tokens.

Example:

```text
button.primary.background
button.primary.background-hover
button.primary.text

card.background
card.border
card.radius

navigation.item.background-active
navigation.item.text-active
```

These should resolve back to global semantic tokens whenever possible.

Avoid creating duplicate values without semantic purpose.

---

# 46. Initial Component Foundation

The first component system should cover:

- Button;
- Icon Button;
- Link;
- Input;
- Search Input;
- Select;
- Checkbox;
- Radio;
- Switch;
- Textarea;
- Card;
- Activity Card;
- Course Card;
- Progress Indicator;
- Badge;
- Avatar;
- Tabs;
- Sidebar;
- Top Navigation;
- Breadcrumb;
- Pagination;
- Table;
- Modal;
- Drawer;
- Dropdown;
- Tooltip;
- Toast;
- Alert;
- Empty State;
- Loading State;
- Error State.

Components should be created when required by actual PFY product surfaces rather than generating a large unused design-system library upfront.

---

# 47. CSS Variable Mapping

A future implementation may expose semantic tokens through variables such as:

```css
--color-bg-canvas
--color-bg-surface

--color-text-primary
--color-text-secondary

--color-action-primary
--color-action-primary-hover

--color-border-default

--font-brand
--font-product

--radius-sm
--radius-md
--radius-lg

--space-1
--space-2
--space-4
--space-6
```

Exact framework-specific implementation belongs to the frontend architecture.

This document defines semantics, not a required CSS architecture.

---

# 48. Tailwind / Framework Mapping

If PFY uses a utility framework, tokens should be mapped centrally rather than duplicated across components.

Conceptually:

```text
PFY Design Tokens
        ↓
Theme configuration
        ↓
Reusable components
        ↓
Application screens
```

Do not allow the framework's default palette to become the PFY design system accidentally.

---

# 49. Implementation Freedom

Implementation may adjust individual numeric values when required for:

- accessibility;
- rendering;
- responsive behavior;
- browser compatibility;
- usability.

Implementation must not independently redefine:

- core brand colors;
- typography families;
- visual hierarchy principles;
- PFY Wave role;
- brand/product visual relationship.

Material changes should return for design/product decision.

---

# 50. Validation Required Before Production Lock

The following remain validation gates:

- exact color contrast matrix;
- Coral CTA combinations;
- link colors;
- focus colors;
- semantic status palette;
- Lora web rendering;
- Plus Jakarta Sans web rendering;
- typography scale across mobile;
- touch targets;
- responsive spacing;
- chart palette;
- H5P integration styling;
- loading/error/empty states.

Therefore:

**Design Tokens v1 establishes the implementation foundation but does not imply that every primitive value is production-locked.**

---

# 51. Initial Surface Validation

Tokens should next be tested against:

1. Public Landing Page;
2. Student Dashboard;
3. Activity Library;
4. Teacher / School Experience.

Validation should include at minimum:

```text
Desktop
Tablet
Mobile
Keyboard navigation
Contrast
Long Portuguese text
Long translated text
Empty states
Loading states
Error states
```

---

# 52. Relationship to Product Specifications

This document owns visual implementation primitives.

It does not own:

- business logic;
- authentication;
- authorization;
- subscription rules;
- student/teacher relationships;
- organization behavior;
- H5P behavior;
- reporting semantics.

Those contracts remain under the relevant PFY product specifications.

Product specs should reference this design system rather than duplicate its visual definitions.

---

# 53. Source of Truth

Visual hierarchy:

```text
resources/brand/BRAND-SYSTEM.md
        ↓
resources/brand/DESIGN-TOKENS.md
        ↓
UI component implementation
        ↓
Product surfaces
```

`BRAND-SYSTEM.md` owns visual intent.

`DESIGN-TOKENS.md` owns implementation-level visual semantics.

The component system consumes these tokens.

Individual pages should not become independent sources of visual truth.

---

# 54. Current State

```text
Brand direction          APPROVED
Brand principles         APPROVED
Logo direction           APPROVED FOR REFINEMENT
Primitive palette        DEFINED
Semantic foundation      DEFINED
Typography foundation    DEFINED
Spacing foundation       DEFINED
Responsive foundation    DEFINED
Accessibility baseline   DEFINED
Status palette           VALIDATION PENDING
Contrast matrix          VALIDATION PENDING
Component system         PENDING
Surface validation       PENDING
Production lock          PENDING
```

---

# 55. Next Step

The next phase is:

**PFY UI Foundation & Surface Validation**

Rather than creating more abstract documentation, the design system should now be tested against real PFY interfaces.

Recommended sequence:

```text
Tokens
  ↓
Core components
  ↓
Student Dashboard
  ↓
Activity Library
  ↓
Teacher / School
  ↓
Public Landing Page
  ↓
Responsive + Accessibility validation
  ↓
Token reconciliation
  ↓
Production design foundation
```

The objective is not pixel-perfect reproduction of the concept image.

The objective is to prove that the PFY identity can support a coherent, accessible and scalable educational platform.

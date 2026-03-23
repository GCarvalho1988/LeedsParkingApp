# Parking App — Style Design Spec

**Date:** 2026-03-23
**Project:** LeedsParkingArea
**Status:** Draft

---

## Overview

Apply the Broccoli-Hair visual style system to the `LeedsParkingArea` parking booking app, maintaining the Sectra UK&I brand identity. The approach ports the design tokens and structural patterns from Broccoli-Hair, then writes the parking-specific UI components (week grid, booking cells) fresh within that system.

---

## Approach: Adapted Core

Port from Broccoli-Hair verbatim:
- CSS custom property palette
- Typography (Barlow + Barlow Condensed)
- Gradient card header with bubble decoration
- Shadow system and `border-radius: 2px` convention
- Orange primary action colour

Write fresh for the parking app:
- Week navigator bar
- Day row grid layout
- Booking cell states (free / mine / taken / past)
- Legend

No site header bar — the app is embedded as a Teams tab; Teams provides the outer chrome.

---

## Layout

- **Container:** Centered card, `max-width: 480px`, responsive down to 320px
- **Background:** `#e8f0f8` (Sectra pale blue page wash)
- **Card:** `background: white`, `border-radius: 2px`, shadow `0 4px 24px rgba(0,70,136,0.12)`
- **Padding:** Card body `1.5rem 1.5rem 2rem`; fluid on mobile (no horizontal scroll)

---

## Colour Palette

Defined as CSS custom properties (matching Broccoli-Hair). `--s-pale` and `--s-grey` from the Broccoli-Hair source are intentionally omitted — they have no usage in the parking app:

| Token | Value | Usage |
|-------|-------|-------|
| `--s-navy` | `#004688` | Week nav labels, day numbers |
| `--s-deep` | `#003260` | Card header gradient start |
| `--s-mid` | `#00548E` | Card header gradient end |
| `--s-cyan` | `#0A93CD` | Bubble decoration, focus rings, nav hover |
| `--s-light` | `#7AAADA` | Secondary icon colour |
| `--s-palest` | `#EEF4FB` | Input/cell background tint |
| `--s-orange` | `#F58025` | Header title accent, primary action |
| `--white` | `#ffffff` | Card background, day label background |
| `--body` | `#1e2d3d` | Body text |
| `--muted` | `#5a6a7a` | Secondary text, day abbreviations |
| `--border` | `#c5d5e8` | Card borders, legend divider |

### Cell State Colours (parking-specific)

| State | Background | Border | Text |
|-------|-----------|--------|------|
| Free | `#fff8ec` | `#f9c97c` | `#92400e` (amber) |
| Mine (booked by current user) | `#f0fdf4` | `#86efac` | `#166534` (green) |
| Taken (booked by other) | `#fef2f2` | `#fca5a5` | `#991b1b` (red) |
| Past / unavailable | `#f3f4f6` | `#e5e7eb` | `#9ca3af` (grey) |

---

## Typography

Both fonts loaded from Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:wght@400;600;700&display=swap" rel="stylesheet">
```

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Body / cell sub-text | Barlow | 300–400 | 0.875rem |
| Card header eyebrow | Barlow Condensed | 600 | 0.62rem, letter-spacing 0.2em, uppercase (slightly smaller than Broccoli-Hair's 0.68rem to suit the narrower 480px card) |
| Card header title | Barlow Condensed | 700 | 1.7rem (slightly smaller than Broccoli-Hair's 1.85rem for the same reason) |
| Week nav label | Barlow Condensed | 700 | 0.8rem, uppercase |
| Day abbreviation | Barlow Condensed | 700 | 0.55rem, uppercase |
| Day number | Barlow Condensed | 700 | 1.1rem |
| Cell state text (line 1) | Barlow Condensed | 700 | 0.85rem |
| Cell sub-label (line 2) | Barlow | 400 | 0.6rem, opacity 0.75 |
| Legend / labels | Barlow | 400 | 0.7rem |

---

## Components

### Card Header

Gradient background `linear-gradient(135deg, var(--s-deep), var(--s-navy), var(--s-mid))`. Bubble decoration via `::after` pseudo-element — port verbatim from `Broccoli-Hair/templates/index.html` lines 126–146 (the `.card-header` parent rule at lines 126–131 must also be included, as it provides the required `position: relative; overflow: hidden`). Orange accent on the keyword in the title (`<em>` styled with `color: var(--s-orange)`).

```
┌──────────────────────────────────────────────┐
│ Sectra UK·I · Leeds Office          ·  ·  ·  │
│ Parking Bookings                   ·  ·  ·   │
│ (deep navy gradient → mid blue)              │
└──────────────────────────────────────────────┘
```

### Week Navigator

White background bar (`border-radius: 2px`, light shadow). Prev/next chevron buttons with border. The prev button is disabled when displaying the calendar week that contains today (i.e. the app's initial load week). Forward navigation is capped at current week + 3 (rolling 4-week window, as defined in the app design spec). Week range label centred in Barlow Condensed uppercase.

### Space Header Row

A non-interactive row above the day grid using the same `grid-template-columns: 3rem 1fr 1fr` layout. The first cell is empty; the second and third show "Space 1" and "Space 2" as small uppercase Barlow Condensed labels (`0.6rem`, `font-weight: 700`, `letter-spacing: 0.12em`, `color: var(--muted)`), centred.

### Day Grid

CSS Grid: `grid-template-columns: 3rem 1fr 1fr` — first column is the day label, second and third are parking Space 1 and Space 2 respectively (as named in the SharePoint list). Five rows (Mon–Fri), 0.4rem gap. Minimum row height `2.75rem` (44px at 16px root font size, matching the 44px touch target requirement). The day label column shows a white card with abbreviated day name and date number.

### Booking Cells

`border-radius: 2px`, `1.5px solid` border, `cursor: pointer` on interactive states. Two lines of text:

| State | Line 1 (state text) | Line 2 (sub-label) |
|-------|--------------------|--------------------|
| Free | `Free ✚` | `Tap to book` |
| Mine | `You ✕` | `Tap to cancel` |
| Taken | Booker's display name | `Unavailable` |
| Past | `—` | `Past` |

Hover effect on Free and Mine cells only: `filter: brightness(0.96)` + `transform: scale(0.98)`. Taken and past cells: `cursor: default`, no hover effect.

### Error Banner

Left-bordered strip (`border-left: 3px solid #ef4444`) on red background tint. Inserted between the week navigator and the day grid, pushing the grid down (no overlay). Only the most recent error is shown — a new error replaces the previous one. Dismissed automatically when the grid re-renders after a successful action.

### Legend

Four items in a flex-wrap row below the grid, separated from grid by a `--border` top border. Each item: coloured dot (matching cell border-radius and colours) + label text.

---

## Mobile

- Card fills full viewport width at `< 480px`, with `1rem` horizontal padding on the page body
- Cell text truncates with `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` at very narrow widths
- Touch targets: minimum `44px` height on interactive cells
- No horizontal scrolling at any viewport width

---

## What Is Out of Scope

- Site header bar (not needed — app lives in Teams tab)
- Nav tabs
- Step-number badges
- File upload widget
- Textarea styles
- Loading spinner — during an async book/cancel call the affected cell shows `opacity: 0.5; cursor: wait; pointer-events: none`. Hover effects are suppressed. The cell reverts to its new state when the Grid re-renders after the call completes.

---

## Reference

- Source style: `Broccoli-Hair/templates/index.html`
- Brand assets: `Broccoli-Hair/uploads/sectra_image1.jpg`, `sectra_image2.png`, `sectra_image7.png`
- Mockup: `.superpowers/brainstorm/970-1774254369/full-mockup.html`
- App design spec: `docs/superpowers/specs/2026-03-22-parking-app-design.md`

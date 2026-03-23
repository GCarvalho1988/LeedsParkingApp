# Dark Mode — Design Spec

**Date:** 2026-03-23
**Status:** Approved

---

## Goal

Add a three-way theme toggle (Light / Dark / System) to the Leeds Parking App. The toggle sits in the top-right corner of the card header. The user's preference is persisted in `localStorage`.

---

## Architecture

A new `theme.js` module owns all theme logic. It is the single source of truth for reading and writing the theme preference, applying the active theme to the DOM, and responding to OS-level changes when in system mode. No other module contains theme logic.

`app.js` imports `theme.js`, calls `applyTheme()` immediately on load (before any UI renders, to avoid flash of wrong theme), and injects the toggle button into the card header.

---

## CSS

Dark mode colours are defined as overrides on `[data-theme="dark"]` applied to `<html>`. The system fallback uses `@media (prefers-color-scheme: dark)` scoped to `:root:not([data-theme])`.

### Dark token values

| Token | Light | Dark |
|-------|-------|------|
| `--white` | `#ffffff` | `#161b22` |
| `--body` | `#1e2d3d` | `#c9d1d9` |
| `--muted` | `#5a6a7a` | `#8b949e` |
| `--border` | `#c5d5e8` | `#30363d` |
| `--s-palest` | `#EEF4FB` | `#0d1117` |
| body bg | `#e8f0f8` | `#0d1117` |
| card bg | `#ffffff` | `#161b22` |

Cell state colours (dark equivalents):

| State | Background | Border | Text |
|-------|-----------|--------|------|
| Free | `#2d1f0a` | `#f58025` | `#f58025` |
| Mine | `#0d2e1a` | `#2ea043` | `#3fb950` |
| Taken | `#2d1616` | `#f85149` | `#f85149` |
| Past | `#1c1c1c` | `#30363d` | `#484f58` |

The card header gradient (`--s-deep` → `--s-navy` → `--s-mid`) remains unchanged in dark mode — it already reads as dark.

---

## `theme.js` Module

**Exports:**
- `applyTheme()` — reads preference from localStorage, sets `data-theme` on `<html>`, attaches/removes the `prefers-color-scheme` listener
- `buildToggle()` — returns a DOM element (the toggle pill) wired up and ready to inject

**Preference values:** `'light'` | `'dark'` | `'system'` (default when nothing stored)

**Logic:**
- `'light'` → `html.setAttribute('data-theme', 'light')`
- `'dark'` → `html.setAttribute('data-theme', 'dark')`
- `'system'` → `html.removeAttribute('data-theme')` + add `matchMedia` listener to re-apply on OS change

**Toggle element:** A `<div class="theme-toggle">` containing three `<button>` elements (☀️ Light, 🌙 Dark, 💻 System). The active button gets class `theme-toggle-active`. Absolutely positioned inside `.card-header`.

---

## `app.js` Changes

1. Import `applyTheme` and `buildToggle` from `./theme.js`
2. Call `applyTheme()` as the very first statement (before `getName()` check)
3. After the page renders, inject `buildToggle()` into `.card-header`

---

## Files Changed

| File | Change |
|------|--------|
| `theme.js` | **Create** — preference store, DOM apply logic, toggle element builder |
| `style.css` | **Add** — dark token block + system media query + toggle pill styles |
| `app.js` | **Update** — call `applyTheme()` on load, inject toggle into header |

No changes to `ui.js`, `api.js`, `identity.js`, or `index.html`.

---

## Out of Scope

- Animated theme transitions
- Per-component theme overrides
- Server-side theme detection

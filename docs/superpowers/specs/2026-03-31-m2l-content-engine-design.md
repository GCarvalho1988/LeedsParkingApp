# M2L Content Engine — Design Spec

**Date:** 2026-03-31  
**Project:** `m2l-content-engine`  
**Location:** `Claude PlayArea/m2l-content-engine/`

---

## Overview

A local content calendar dashboard for the Manchester to London charity cycling event (28 June 2026), raising £1,000 for Ambitious about Autism via Rapha. The dashboard runs with `npm run dev`, reads/writes markdown draft files and JSON config via a local Express API, and provides a single-page React UI for managing the 13-week LinkedIn content campaign.

No AI integrations, no database, no auth. Content generation happens conversationally through Claude Code reading config files and writing drafts. The dashboard displays and edits what's there.

---

## Campaign Context

| Field | Value |
|---|---|
| Ride | Manchester to London |
| Ride date | 28 June 2026 |
| Distance | 200 miles |
| Charity | Ambitious about Autism |
| Organiser | Rapha |
| Fundraising target | £1,000 |
| Fundraising URL | https://www.justgiving.com/page/guilherme-carvalho-manchester-to-london |
| Campaign start | 30 March 2026 |
| Platform | LinkedIn only |
| Author | Guilherme Carvalho, Head of Sales, Sectra UK&I |

Key events:
- 06–07 May 2026: Sectra UK User Meeting (work)
- 10 May 2026: Fred Whitton Challenge (ride)
- 28 June 2026: Manchester to London (ride)

---

## Project Structure

```
m2l-content-engine/
├── README.md
├── package.json
├── .gitignore
├── vite.config.js
├── index.html
├── config/
│   ├── campaign.json
│   └── posting-rules.json
├── content/
│   ├── drafts/               # Markdown files: week-NN-day-type.md
│   └── templates/            # story.md, milestone.md, ask.md, thank.md, training.md
├── server/
│   └── index.js              # Express API on port 3001
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── components/
│   │   ├── Calendar.jsx
│   │   ├── PostCard.jsx
│   │   ├── DetailPanel.jsx
│   │   ├── StatusBar.jsx
│   │   ├── EventManager.jsx
│   │   └── PhaseTimeline.jsx
│   ├── hooks/
│   │   └── useApi.js
│   └── styles/
│       └── index.css
└── output/
    └── calendar.md           # Optional generated overview
```

---

## Architecture

**Dev setup:** Two servers, one command.
- `npm run dev` uses `concurrently` to start Vite (port 5173) and Express (port 3001) in parallel.
- Vite proxies `/api/*` to `http://localhost:3001` so the React app calls `/api/...` without CORS concerns.
- Express serves only the API. Vite serves the React app.

**Data flow:**
```
React components
    ↓ fetch /api/*
Vite dev server (proxy)
    ↓
Express API (port 3001)
    ↓ fs.readFile / fs.writeFile
config/campaign.json
config/posting-rules.json
content/drafts/*.md (gray-matter for frontmatter parse/stringify)
```

**Key packages:**
- `vite` + `@vitejs/plugin-react` — frontend build
- `express` — API server
- `concurrently` — single dev command
- `gray-matter` — markdown frontmatter parse/stringify
- `cors` — Express middleware

---

## Config Files

### config/campaign.json

```json
{
  "ride": {
    "name": "Manchester to London",
    "date": "2026-06-28",
    "distance_miles": 200,
    "charity": "Ambitious about Autism",
    "fundraising_target": 1000,
    "fundraising_url": "https://www.justgiving.com/page/guilherme-carvalho-manchester-to-london",
    "organiser": "Rapha"
  },
  "campaign_start": "2026-03-30",
  "current_raised": 0,
  "phases": [
    { "id": "why", "label": "The Why", "weeks": [1,2,3,4], "description": "..." },
    { "id": "journey", "label": "The Journey", "weeks": [5,6,7,8,9], "description": "..." },
    { "id": "push", "label": "The Push", "weeks": [10,11,12,13], "description": "..." }
  ],
  "key_events": [
    { "date": "2026-05-06", "name": "Sectra UK User Meeting (Day 1)", "type": "work" },
    { "date": "2026-05-07", "name": "Sectra UK User Meeting (Day 2)", "type": "work" },
    { "date": "2026-05-10", "name": "Fred Whitton Challenge", "type": "ride" },
    { "date": "2026-06-28", "name": "Manchester to London", "type": "ride" }
  ],
  "author": {
    "name": "Guil",
    "full_name": "Guilherme Carvalho",
    "role": "Head of Sales, Sectra UK&I",
    "background": "Portuguese, based in Leeds. Cyclist. Works in healthcare technology. Came to this cause through admiration for Simon Mottram (Rapha founder) and his personal commitment to this charity, not through personal experience with autism."
  }
}
```

### config/posting-rules.json

- Platform: LinkedIn
- Best days: Tue/Wed/Thu; best times: 08:00–10:00, 12:00–13:00
- Max length: 1,300 characters
- Frequency: 1–2 posts/week, never consecutive days
- Link placement: fundraising link as first COMMENT (not in post body — LinkedIn suppresses external links)
- Tone: direct, honest, British English, self-deprecating humour welcome, no guilt-tripping, no fake emotion
- Content types: story, milestone, ask, thank, training

---

## Draft File Format

Filename pattern: `week-NN-day-type.md` (e.g. `week-03-tue-story.md`)

```markdown
---
week: 3
day: Tuesday
date: 2026-04-14
content_type: story
status: draft
platform: linkedin
suggested_time: "08:30"
title: "Why Ambitious about Autism"
---

[Post body]

---

## Posting Notes
- Timing: Tuesday morning, 08:30
- Remember: fundraising link goes as first comment, not in post body
```

Valid statuses: `draft`, `ready`, `posted`, `skipped`

---

## Express API (server/index.js — port 3001)

### Config endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/api/campaign` | Returns campaign.json |
| PUT | `/api/campaign` | Updates campaign.json |
| GET | `/api/posting-rules` | Returns posting-rules.json |

### Draft endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/api/drafts` | All drafts — parsed frontmatter + body |
| GET | `/api/drafts/:filename` | Single draft |
| PUT | `/api/drafts/:filename` | Update draft (frontmatter + body) |
| DELETE | `/api/drafts/:filename` | Delete draft |

### Event endpoints
| Method | Path | Description |
|---|---|---|
| POST | `/api/events` | Add key event to campaign.json |
| DELETE | `/api/events/:date` | Remove key event by date |

All endpoints return JSON. PUT/POST bodies are JSON. File I/O uses Node `fs/promises`. Drafts parsed/written with `gray-matter`.

---

## React Dashboard

### Design System

**Fonts:** DM Sans (body: 400/500/600/700) + DM Serif Display (headings: 400) — Google Fonts  
**All colours via CSS variables:**

```css
--sidebar-bg: #1B1B1E
--content-bg: #FAFAFA
--phase-why: #E85D26       /* orange */
--phase-journey: #2D6A4F   /* green */
--phase-push: #1B1B1E      /* dark */
--linkedin: #0A66C2
--status-draft: #9E9E9E
--status-ready: #2D6A4F
--status-posted: #1B1B1E
--status-skipped: #BDBDBD
```

**Date format:** DD/MM/YYYY throughout (British).  
**Aesthetic:** Editorial, minimal chrome. Not generic dashboard. No card shadows everywhere.

### Layout

Three-column, full-viewport-height:
```
[ Sidebar 200px ] [ Main area — flex 1 ] [ Detail Panel 260px ]
```

Detail panel is always visible. When no post is selected, it shows an empty state: "Select a post to view and edit."

### Sidebar (dark, #1B1B1E)

- **Header:** "M → L" in DM Serif Display 28px; subtitle "28 June 2026 · £1,000"; JustGiving link
- **Status section:**
  - Current week number + phase name (derived from today vs `campaign_start`)
  - Days until ride countdown
  - Fundraising progress bar (`current_raised / fundraising_target`) with inline editable amount — click value to edit, Enter/blur saves via `PUT /api/campaign`
  - Post counts: draft / ready / posted / skipped
- **Key Events:** list from `campaign.json`, colour-coded by type (ride = orange, work = LinkedIn blue). Add event form (date, name, type → `POST /api/events`). Delete button per event.
- **Phase legend:** three swatches with labels and week ranges.

### Main Area

**Phase Timeline Bar** (32px, sits at top of main area):
- Three segments proportional to phase week counts (4 / 5 / 4)
- Labelled: "The Why · Wk 1–4", "The Journey · Wk 5–9", "The Push · Wk 10–13"
- Clickable to filter calendar to that phase (toggle; clicking again shows all)

**Calendar Grid** (scrollable):
- 13 week rows
- Each row: week badge (phase-coloured circle) | date range DD/MM | event pins (if any key events fall that week) | post cards
- Current week: highlighted with a phase-coloured ring
- Phase transitions: subtle labelled separator between phase groups
- Empty weeks: "No posts planned" in muted italic

### Post Cards

Compact, inside calendar rows. Show: day abbreviation, content type icon, title (truncated), status dot.

Content type icons: story 📖, milestone 🏔️, ask 🙏, thank ❤️, training 🚴

Click → opens in Detail Panel.

### Detail Panel (white, 260px)

- Post title in DM Serif Display
- Metadata chips: date, suggested time, platform
- Status toggle buttons (draft / ready / posted / skipped) — click changes status, auto-saves via `PUT /api/drafts/:filename`
- Full post body in `<textarea>` (editable inline)
- Save button → `PUT /api/drafts/:filename` with updated body + frontmatter
- Copy to Clipboard button
- LinkedIn tips box (blue left-border):
  - Best times: Tue–Thu, 8–10am or 12–1pm
  - ⚠️ Link goes as first comment, not in post body
  - Live character count vs 1,300 limit

### useApi.js hook

Thin wrapper around `fetch`. Exports: `getCampaign`, `updateCampaign`, `getDrafts`, `getDraft`, `updateDraft`, `deleteDraft`, `addEvent`, `deleteEvent`, `getPostingRules`. All return promises, handle JSON parse.

---

## Content Templates

Five markdown reference files in `content/templates/`: `story.md`, `milestone.md`, `ask.md`, `thank.md`, `training.md`. Each shows structural pattern: opening hook style, body rhythm, CTA placement, approximate length. Reference guides only — not rigid formats.

---

## README

Covers: setup (`npm install`, `npm run dev`), project structure, and a "Generating Content" section with example Claude Code prompts for generating drafts, reviewing against posting rules, and updating for real events.

---

## Implementation Notes

1. No AI/Anthropic SDK — no external API calls. Content generation is conversational via Claude Code.
2. `.gitignore`: `node_modules/`, `.env`
3. `.npmrc`: `registry=https://registry.npmjs.org` — bypasses Sectra internal registry
4. Initialize git, create private GitHub repo `m2l-content-engine`, make initial commit, push.
5. `content/drafts/` starts empty. Templates only.
6. Week number derived from `campaign_start` date: `week = Math.ceil((today - campaignStart) / 7) + 1`

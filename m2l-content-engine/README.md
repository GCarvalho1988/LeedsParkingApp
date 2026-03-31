# M → L Content Engine

Local content calendar dashboard for the Manchester to London charity cycle ride — 28 June 2026, raising £1,000 for Ambitious about Autism via Rapha.

## Setup

```bash
npm install
npm run dev
```

Opens at http://localhost:5173. Requires Node 18+.

## How it works

- `config/campaign.json` — campaign dates, phases, key events, fundraising target
- `config/posting-rules.json` — LinkedIn timing, tone, frequency rules
- `content/drafts/` — one markdown file per post (`week-NN-day-type.md`)
- `content/templates/` — structural guides for each content type

Content drafts are plain markdown files with YAML frontmatter. The dashboard reads and writes them via a local Express API on port 3001. No database, no cloud sync.

## Dashboard features

- **Calendar view** — 13-week grid with phase colour-coding, event markers, and post cards
- **Detail panel** — edit draft text, toggle status (draft/ready/posted/skipped), copy to clipboard
- **Status bar** — countdown, fundraising progress (click to update), post counts by status
- **Event management** — add/remove key events from the sidebar

## Generating content

Content drafts are generated and reviewed conversationally through Claude Code — not through the dashboard. The dashboard shows, edits, and manages what's there.

### Generating drafts

```
Read config/campaign.json and config/posting-rules.json, then generate a LinkedIn draft for week 5.
Write it to content/drafts/ following the template format in content/templates/.
```

```
Generate all drafts for the 'why' phase (weeks 1–4). Vary the opening hooks and emotional register
across posts. Write each to content/drafts/ using the filename pattern week-NN-day-type.md.
```

### Reviewing drafts

```
Review content/drafts/week-03-tue-story.md against the posting rules in config/posting-rules.json.
Give me critical feedback on tone, length, CTA, and authenticity. Don't rewrite it — just tell me what's wrong.
```

```
Read all drafts in content/drafts/ and flag any that sound too corporate or use guilt-tripping.
```

### Updating for real events

```
The fundraising page shows £340 raised. Update config/campaign.json current_raised to 340 and
regenerate the week 6 draft to reflect this milestone.
```

```
Fred Whitton is done — I finished in 11 hours, Hardknott was brutal. Write the week 7 debrief
post based on the milestone template in content/templates/milestone.md.
```

## Posting workflow

1. Open http://localhost:5173
2. Click a post card to open it in the detail panel
3. Review and edit the draft
4. Mark as **Ready** when happy
5. Copy to clipboard and paste into LinkedIn
6. Post the fundraising link as the **first comment** (LinkedIn suppresses posts with external links)
7. Mark as **Posted** in the dashboard

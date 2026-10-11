# PranVayu: UX and visual design spec

Goal: a screen a worried parent understands in five seconds, that does not look like a template. This document is binding for the frontend. If a choice here conflicts with a library default, the spec wins.

## 1. Design idea

**The screen is a page from a school diary.** The signature element is the school-day timetable: rows for arrival, assembly, break, PE and dispersal, ruled like a notebook page, each row carrying an air verdict. A parent already knows how to read it. Everything else supports it.

Why this and not a dashboard or an editorial layout: the product's one job is a decision about a school day, so the school day is the structure. A newspaper look, a card grid, or a map-first page would all be defaults that could carry any subject.

Spend the boldness in one place: the timetable. The rest stays quiet.

### What I rejected on review

- Cream paper, serif display, terracotta accent: common generated look, and it says nothing about school or air.
- Dark mode with one bright accent and a map background: a "monitoring tool" look, wrong for a parent at 9 pm.
- Cards of KPIs ("PM2.5: 184, AQI: Very poor"): the number is the thing we are trying to move parents beyond.

## 2. Tokens

### Colour

| Name | Hex | Use |
|---|---|---|
| Notebook | #FBFCFE | Page background |
| Rule blue | #C9D6EA | Notebook lines, chart gridlines, dividers |
| Ink | #14233C | Text, shapes, primary lines |
| Ink soft | #4A5B78 | Secondary text, units, timestamps |
| Margin grey | #9AA6B8 | Left margin line, disabled |
| Panel | #EEF2F8 | Replay banner, evidence tables, selected row |

Category colours (data only, never decoration): use CPCB's published category colours for Good, Satisfactory, Moderate, Poor, Very poor, Severe in chart zones and small chips. Verify exact hex values against CPCB's bulletin and check each against Ink text for AA contrast. Where a category colour fails contrast with text, place Ink text on a Notebook chip beside the colour swatch rather than on it.

Primary actions use Ink as a filled button (white text) or an underlined link. There is no brand accent colour. If a second colour is needed for focus rings, use #2447C8 at 3 px offset.

### Type

One family, chosen because it covers both scripts with matched proportions: **Mukta** (Latin and Devanagari), weights 400, 600, 800. Fallbacks: system sans with Devanagari support. Load with `font-display: swap`; subset to Latin plus Devanagari.

| Role | Size / line | Weight |
|---|---|---|
| Verdict headline | 28/34 mobile, 36/42 desktop | 800 |
| Section heading | 21/28 | 600 |
| Body | 17/26 | 400 |
| Table text | 16/24 | 400, verdict word 600 |
| Meta (timestamps, units) | 14/20 | 400 |

Sentence case everywhere. No all-caps labels, no letter-spaced eyebrows, no italics for emphasis in headlines, no single highlighted word in a headline. Tabular numerals for all numbers. Line length 65 characters or fewer. Left aligned.

### Space and shape

- Base unit 8 px. Notebook line height 40 px for timetable rows (one rule per row).
- One corner radius: 4 px on buttons and chips. Nothing else is rounded.
- No shadows. Depth comes from rules and the Panel colour.
- No gradients.

### Motion

- One orchestrated moment on first load: the air line draws left to right once (600 ms), then the clean window bracket appears.
- Responses to actions only: expanding "Why", switching day, switching language (text swap, no slide).
- No entrance animations on sections, no hover lifts. Respect `prefers-reduced-motion` by showing the final state at once.

## 3. Layout

Mobile first at 360 px. Single column, content width up to 560 px. On desktop (over 900 px) two columns: left holds headline and timetable, right holds the air line and why. Maximum page width 1040 px, left aligned in the viewport.

### Home (answer) screen, 360 px wireframe

```
+------------------------------------------+
| Air near  Dwarka v        English | हिन्दी |
| School day  Tue 13 Oct   [Today][Tomorrow][Wed] |
+------------------------------------------+
| Skip the outdoor assembly.               |
| PE at 11:30 is fine.                     |
| Cleanest time to play: 3:00 to 5:30 pm   |
| How sure: medium                         |
+------------------------------------------+
| 07:30 | Arrive          | (o)  Go        |
| 07:45 | Assembly        | (x)  Skip      |
| 10:30 | Break           | (/)  Limit     |
| 11:30 | PE              | (o)  Go        |
| 14:30 | Dispersal       | (/)  Limit     |
|       |   each row opens: PM2.5 range    |
+------------------------------------------+
| [48-hour air line, direct labels]        |
+------------------------------------------+
| Why                                      |
|  Smoke may arrive 2 to 8 pm. (medium)    |
|  Calm air this morning traps local smog. |
+------------------------------------------+
| Official: CAQM GRAP Stage II (as of ...) |
| Data: fires 1h ago, winds 3h, station 40m|
| Share on WhatsApp    How we checked this |
+------------------------------------------+
```

The locality and day controls read as one sentence at the top ("Air near Dwarka, school day Tuesday"), not as a toolbar.

### Signature component: the timetable

- Columns: time (tabular, left), activity, verdict (shape plus word), and a disclosure for the PM2.5 range and band.
- Rows sit on pale blue notebook rules; a single margin-grey vertical line separates time from the rest.
- Verdict shapes are drawn SVG, not emoji: filled circle for Go, half-filled for Limit, circle crossed by a bar for Skip. Word is always present.
- Tapping a row expands in place: "PM2.5 about 84 (70 to 105) at 7:45. Light activity: Skip above 90, so this is borderline." Use the real thresholds.
- Editing times: a "Change times" link opens an inline form in the same table, not a modal.

### The air line

One chart, 48 hours, hand-built SVG.
- Median line in Ink, p10-p90 band in Rule blue at 40% opacity.
- Category zones as horizontal bands with the category name written inside the band at the left edge (no legend).
- Night hours shaded Panel. School hours shown as a bracket above the axis.
- Smoke arrival: a bracket on the time axis labelled "smoke may arrive", with width equal to the ETA range.
- Clean window: a bracket below the line labelled with the time range.
- Observed values (past hours) drawn as dots; forecast as line.
- Keyboard: arrow keys step through hours and announce time, range and category to screen readers.

### Other screens

**Smoke detail.** Map (Leaflet with OpenStreetMap tiles at low volume, attribution shown, or MapLibre with OpenFreeMap; verify terms) with recent fires sized by fire radiative power, three sample air paths ending at the chosen locality, hour tick marks every 12 h. Below: three short paragraphs: what the model did, how wide the ETA is and why, what it cannot know (night-time burns, clouds hiding fires, how much smoke reaches ground level).

**Evidence.** Title "How we checked this". A short paragraph about the replay window, then four small tables (lead time, forecast error, verdict accuracy, band coverage), each with one sentence of plain reading and one sentence of limits. Numbers come from the evaluation job output.

**Method and credits.** Plain language, sources with licences, disclaimer, repo link, AI tools used.

## 4. States

| State | Behaviour |
|---|---|
| Loading | Skeleton of the timetable rows (same ruled layout), no spinner |
| Stale data | Banner under the headline: "Station readings are 4 hours old. Treat this as lower confidence." Confidence label drops |
| Partial data | Same banner naming the missing source; verdicts still shown with the wider band |
| API down | Show last good result, with its age on the headline: "From 3:10 pm. Could not refresh." |
| No smoke signal | Smoke card says "No stubble smoke signal for this locality in the next 48 hours." |
| Off-season (Dec to Sep) | Smoke card collapses to one line; drivers show trapping only |
| Replay | Panel-coloured banner pinned under the header: "Replay of 3 to 10 Nov 2025. This is a past event run through the same model." Scrubber replaces the day tabs |
| Low confidence | Headline ends with "How sure: low. Check official updates." Verdicts use the upper end of the band |
| First visit | Locality sentence is the only prompt: "Air near [choose your area]". No tour, no modal |

## 5. Content design

Rules from the brief: words exist to make decisions easier; plain verbs; sentence case; errors say what happened and what to do; the same action keeps the same name everywhere.

- Verdict words: Go, Limit, Skip. In Hindi: बाहर ठीक है, कम समय और हल्की गतिविधि, बाहर न रखें.
- Headline templates (deterministic, filled from the payload):
  - All Go: "Outdoor time is fine today." (आज बाहर का समय ठीक है।)
  - Mixed: "Skip the outdoor assembly. PE at 11:30 is fine." (बाहर की असेंबली न रखें। 11:30 का पीटी ठीक है।)
  - All Skip: "Keep everything indoors. The least bad time is 3 to 4 pm." (सब कुछ अंदर रखें। सबसे कम खराब समय 3 से 4 बजे है।)
- Confidence line: "How sure: high / medium / low." (भरोसा: ऊँचा / मध्यम / कम.)
- Smoke sentence: "Smoke from fires in Punjab and Haryana may reach here between 2 and 8 pm." (पंजाब और हरियाणा की आग का धुआँ यहाँ दोपहर 2 से शाम 8 बजे के बीच पहुँच सकता है।)
- Calibration sentence on every smoke card: "Smoke is one of several causes. Studies disagree on how much of Delhi's PM2.5 it explains."
- Error: "We could not refresh the data. Showing the 3:10 pm update."
- Buttons: "Share on WhatsApp", "Change times", "How we checked this". No arrows appended, no "Learn more".
- Hindi strings are hand-written; have a native reader check them before submission.

## 6. Banned patterns

Rejecting these is part of the spec. If an agent produces one, remove it.

- Gradient backgrounds, gradient text, glass or blur effects, glowing shapes.
- Rows of identical rounded cards with shadows; KPI tile rows.
- Emoji as icons or as verdict markers.
- Tracked-out all-caps labels, eyebrow text above headings, numbered markers on non-sequential content, spaced em-dash labels, dot-joined meta strings, arrows appended to links.
- Monospace for small data labels.
- Fade-up on scroll, staggered card entrances, hover lift.
- A hero section with a big number and a small label.
- Purple, teal or neon accents; a "brand" accent colour.

## 7. Accessibility

- Contrast AA for all text; check category chips separately.
- Verdicts: word plus shape plus colour.
- Focus ring 3 px, never removed.
- Touch targets 44 px or larger.
- Hindi and English both tested with a screen reader label pass on timetable and chart.
- Reduced motion respected; no content depends on motion.
- Language attribute set per language; Devanagari text uses the Devanagari font stack.

## 8. Performance budget

- Home route JavaScript under 200 KB gzipped, CSS under 30 KB, no chart or UI library (hand-built SVG, small i18n dictionary).
- Fonts subset and preloaded; at most two weights above the fold.
- API response for one locality under 60 KB.
- Map and its tiles load only on the smoke detail screen.

## 9. Test script (run with three people tonight and tomorrow)

1. Hand someone a phone with the app on first load. Ask: "Tomorrow, can your child do PE outside in Rohini?" Time to answer must be 20 seconds or less with no help.
2. Ask: "How sure is the app about that?" They must find the confidence line.
3. Ask them to change PE to 12:15 and say what changed.
4. Switch to Hindi and ask them to read the headline aloud; note any word they stumble on.
5. Open the evidence page and ask what the app got wrong. They should be able to answer from the page.

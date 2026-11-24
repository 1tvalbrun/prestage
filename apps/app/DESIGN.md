---
name: Prestage
description: The interview before the interview.
colors:
  paper: "#f7f8fa"
  paper-hover: "#f1f4f8"
  paper-press: "#e8edf3"
  card: "#ffffff"
  rail: "#ffffff"
  ink: "#151a21"
  ink-2: "#4e5866"
  ink-3: "#66707e"
  ink-4: "#b4bcc7"
  line: "#e5e9ee"
  line-2: "#d6dce4"
  signal-blue: "#0e5fd8"
  signal-blue-hover: "#0b4fb6"
  signal-bg: "#e8f0fc"
  signal-line: "#c4d9f6"
  curtain-red: "#c93a26"
  curtain-red-deep: "#a82d1c"
  ok: "#3d7a32"
  ok-bg: "#eaf2e4"
  warn: "#8a5a12"
  warn-bg: "#f6eedb"
  warn-line: "#e9d9b6"
  stage: "#101418"
  stage-2: "#1c222a"
  stage-3: "#262d36"
  stage-card: "#171c22"
  stage-rail: "#0b0f13"
  stage-ink: "#e7eaee"
  stage-ink-2: "#a5adb8"
  stage-ink-3: "#76808c"
  stage-ink-4: "#4a5461"
  stage-line: "#262d36"
  stage-line-2: "#333c47"
  stage-signal-blue: "#7fb0f9"
  stage-signal-blue-hover: "#9cc3fb"
  stage-signal-bg: "#152944"
  stage-signal-line: "#2a4a74"
  stage-curtain-red: "#e05540"
  stage-ok: "#8fbf7f"
  stage-warn: "#d9a853"
  stage-warn-bg: "#2c2515"
  stage-warn-line: "#443921"
typography:
  display:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "25px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Spline Sans Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.09em"
  quote:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  xs: "5px"
  control: "10px"
  field: "11px"
  card: "20px"
  hero: "25px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "24px"
  gutter: "48px"
components:
  button-primary:
    backgroundColor: "{colors.signal-blue}"
    textColor: "{colors.card}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.signal-blue-hover}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink-2}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
  button-secondary-hover:
    backgroundColor: "{colors.paper-hover}"
  button-end-session:
    backgroundColor: "{colors.curtain-red}"
    textColor: "{colors.card}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  chip-selected:
    backgroundColor: "{colors.signal-bg}"
    textColor: "{colors.signal-blue}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "11px 14px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "20px"
  badge-verdict:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn}"
    rounded: "{rounded.pill}"
    padding: "2.5px 10px"
  badge-lane:
    backgroundColor: "{colors.paper-hover}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "2.5px 9px"
---

# Design System: Prestage

## Overview

**Creative North Star: "Backstage and Stage"**

Prestage has two worlds and one voice. Backstage is where the user prepares:
paper-toned surfaces, ink text, mono labels, receipts and citations, a rail of
practices down the left. It is calm and unhurried, serious and exacting,
honest and plain. Nothing decorates; every mark carries information. The
stage is the room: always dark, grained, lit for one photoreal counterpart,
and the only place the system permits gradients, glows, and theatre (the
loading shimmer excepted). The user
walks from one into the other and back, and the debrief they return to is
backstage again.

Density is moderate and even. Type is small and confident (13.5px body, 25px
page titles), spacing is generous, and hierarchy comes from weight, tracking,
and the three ink tones rather than from size jumps. One color acts: Signal
Blue marks the action, the selection, and the focus, and nothing else does.
Red is the curtain: it fills only the mark and the button that ends a
session, and it never marks a status or a verdict. Lanes and personas are colorless on purpose, so a
new lane never needs a new color.

The confirmed anti-reference is the generic AI dashboard: gradient heroes,
glassmorphism, scorecards, gamified progress, and traffic-light status. A
gap is a finding, not a failure, and the palette never says otherwise.

**Key Characteristics:**
- Two worlds: flat, tonal backstage; cinematic, always-dark stage
- One action color (Signal Blue), one curtain color (Curtain Red), no lane colors
- Three typefaces with strict jobs: Instrument Sans speaks for the interface, Source Serif for anything spoken, Spline Mono for labels
- Hairline borders and whisper shadows; depth from surface tints
- Pills for metadata, 10px controls, 20px cards, nothing square except the logo mark
- Light and dark themes for backstage; the stage ignores the toggle

## Colors

A paper-and-ink workspace with one blue signal, and a charcoal stage that
keeps the same roles at lower light.

### Primary
- **Signal Blue** (`{colors.signal-blue}`, dark `{colors.stage-signal-blue}`): the only action color. Primary buttons, selected chips, links, focus rings, the active step in the flow rail, the "Continue" pill on a practice card. In dark mode the blue lightens and button labels flip to dark ink (#0b1526).
- **Signal Wash** (`{colors.signal-bg}` on `{colors.signal-line}`): the tinted field behind a selected chip, a citation badge, and text selection. Never a button fill.

### Secondary
- **Curtain Red** (`{colors.curtain-red}`, deep `{colors.curtain-red-deep}`): its only fills are the logo dash and the End Session button. As text and small marks it carries form errors, blocker-severity gap dots, the cross on items that didn't hold, and destructive hovers. The shadcn destructive token is an alias of this same value, so field errors are the same red. It never fills a pill on screen and never marks a verdict or a lane.

### Tertiary
- **Amber Verdict** (`{colors.warn}` on `{colors.warn-bg}` with `{colors.warn-line}`): every verdict pill, whatever its tone. Also the mic check's caution state.
- **Quiet Green** (`{colors.ok}` on `{colors.ok-bg}`): the available dot on a persona, a mic check that passed, a delivered to-do. Small marks only, never a fill behind text blocks.

### Neutral
- **Paper** (`{colors.paper}`): the page. **Paper Hover** (`{colors.paper-hover}`) and **Paper Press** (`{colors.paper-press}`) are the two tonal steps for hover and pressed states and for count pills.
- **Card** (`{colors.card}`): raised surfaces, buttons, inputs, chips. **Rail** (`{colors.rail}`): the sidebar and the flow header.
- **Ink** (`{colors.ink}`): headings and primary text. **Ink 2** (`{colors.ink-2}`): body text and secondary buttons. **Ink 3** (`{colors.ink-3}`): labels, kickers, metadata; darkened from the mocks to clear 4.5:1. **Ink 4** (`{colors.ink-4}`): placeholders, hidden-until-hover icons, and the lane dot.
- **Line** (`{colors.line}`): card and section borders. **Line 2** (`{colors.line-2}`): control borders (buttons, inputs, chips) and the scrollbar thumb.
- **Stage** family (`{colors.stage}` through `{colors.stage-line-2}`): the same roles at lower light. Backstage uses them under the dark theme; the room uses them always.

### Named Rules
**The One Signal Rule.** Signal Blue is the only color that means "act here." A view carries at most one filled blue button. Everything else that wants attention uses weight, tracking, or position.

**The Curtain Rule.** Red fills exist in two places: the logo dash and End Session. Red text and small red marks may carry form errors, blocker gaps, failed items, and destructive hovers. Red never fills a pill on screen, never marks a verdict, and never identifies a lane.

**The Colorless Lane Rule.** Lanes, personas, and roles carry no identity color. Identity comes from the label and the photograph.

**The Amber Verdict Rule.** Verdicts always wear the amber pill. Tone (good, mid, bad) is carried by the word and by direction copy ("up from last time"), never by green or red.

## Typography

**Display Font:** Instrument Sans (with system-ui)
**Body Font:** Instrument Sans (with system-ui)
**Quote Font:** Source Serif 4, italic (with Georgia)
**Label/Mono Font:** Spline Sans Mono, 400 and 500 (with ui-monospace)

**Character:** A working sans that stays small and tight, a serif that appears only when someone speaks, and a mono that labels everything without raising its voice. The pairing reads like a well-kept dossier.

### Hierarchy
- **Display** (600, 25px, 1.2, -0.02em): page titles on home, the hub, the session page, settings. The sign-in headline is the one exception at 34px, 48px on large screens, 1.08.
- **Headline** (600, 19 to 20px, 1.2, -0.015em): stage headings inside the flow ("What are you building?", "Who's across the table?") and the welcome legend.
- **Title** (600, 14 to 15px): card names, debrief section titles, the transcript dialog title.
- **Body** (400, 13.5px, 1.5): the default. Lead paragraphs step to 15 to 15.5px with 1.5. Fine print steps to 12.5px, and the smallest helper text to 11.5px on Ink 4. Inputs render at 14px, and at 16px under 768px so iOS does not zoom.
- **Label** (mono, 400, 10 to 11px, uppercase, 0.09em; 500 only on the few stamps that sit on a tinted fill): kickers, flow rail steps, panel titles, lane headers in the rail, metadata. Wider tracking (0.14 to 0.16em) marks the room's chrome; tighter (0.04em) marks inline stamps.
- **Quote** (serif italic, 13 to 15px, 1.5): a persona's signature question, a verdict quote, a to-do the counterpart asked for. The room's closing line steps up to 27px roman, 22px on phones.
- **Sans caps** (600, 11px, uppercase, 0.09em, Ink 3): section titles inside panels. The mono label and the sans cap are siblings; the mono one is metadata, the sans one is structure.

### Named Rules
**The Spoken Serif Rule.** Source Serif appears only where a counterpart said or would say the words: quotes, verdicts, signature questions, the closing line. The interface never speaks in serif.

**The Mono Label Rule.** Anything that names, stamps, or counts is mono, uppercase, 10 to 11px, tracked 0.09em, on Ink 3. It never exceeds 11px and never carries a sentence.

**The Small Type Rule.** Body is 13.5px and titles are 25px. Hierarchy comes from weight and ink tone, not from size. Do not introduce a 32px or larger heading backstage.

**The Backstage Scale Rule.** There is no public landing page yet. The Small Type Rule governs backstage and the flow. A persuade surface built later sets its own display scale in its surface brief and never pushes that scale back into the app.

## Layout

Backstage is a fixed rail plus a centered column. The rail is 264px wide,
flush left, with hairline right border, Rail surface, 14px side padding. On
phones it becomes a 280px drawer with the only lifted shadow in the system,
behind a 40px hamburger in a Rail-colored header. Content is centered at a
1200px maximum (home, archived) or 1320px (practice hub), with 48px side
gutters that step to 24px under 1024px and 20px under 768px. The hub splits
into a main column and a 348px side column at 1280px and above with a 112px
gap. Top padding is 52px on list pages, 40px on the hub, 28 to 32px on
phones. Long-form legal and empty states cap at 640px.

The flow (brief through room) drops the rail. A slim header carries the
wordmark, the four-step rail centered in mono caps, and the exit button. Step
labels hide under 768px, leaving the current step name. Stage content sits in
a single column with the pack's preview rail alongside on wide screens.

The room is full bleed and always dark. At 1024px and above it is a
three-column grid: a 244px left column holding the user's camera tile and
live notes, the stage, and a 336px transcript column, both side columns on
Stage Card behind a hairline. Below that it stacks: the stage first, the
left column becomes a horizontal strip capped at 26% of the viewport
height, and the transcript hides behind a button. Chrome (topic chip,
clock, ribbon) floats at the top center in translucent black.

The home grid is auto-fill with a 300px minimum column (280px for the lane
cards), so column count follows width, collapsing to one column under
768px. It caps at nine practice cards. Rhythm is small and even: 4, 8, 12,
18, 24. Cards pad 17 to 22px. Sections separate with 18px and a hairline.

Breakpoints are Tailwind's (768, 1024, 1280), written mostly as max-width
overrides: the desktop layout is the source and phones are the exception.
Touch targets grow to 36 to 40px under 768px and on coarse pointers, and
hidden-until-hover controls become always visible there.

## Elevation & Depth

Depth follows the world.

Backstage is flat. Surfaces stack by tint: Paper, then Card, with Paper Hover
and Paper Press as the two interaction steps. Borders are hairlines (Line
for containers, Line 2 for controls). The only shadows are whispers, and
they mark category, not height: every card wears the card shadow, every
solid button the button shadow. Hover lifts a card one pixel (two on the
lane cards) and tints it, but never grows its shadow. The mobile drawer and
the undo toast are the two lifted surfaces.

The stage may do what backstage cannot. The room paints a charcoal-to-black
vertical gradient, overlays film grain at 5 to 9% opacity, uses a radial
highlight on the counterpart's placeholder, and floats its chrome in black at
60 to 70% alpha with a hairline. Attention loops (the red recording ring,
the expanding mic ring, the equalizer bars, the shimmer skeleton, the
blinking cursor) are not confined to the room: they run wherever a live
process is underway: the room, the brief's voice capture, the pre-read
waiting screen, and the sign-in page's live dot. All of them stop under
reduced motion.

### Shadow Vocabulary
- **Card whisper** (`box-shadow: 0 1px 3px rgba(21, 26, 33, 0.06)`; dark `0 1px 3px rgba(0, 0, 0, 0.3)`): every raised container, the search field.
- **Button whisper** (`box-shadow: 0 1px 2px rgba(21, 26, 33, 0.13)`; dark `0 1px 2px rgba(0, 0, 0, 0.5)`): solid buttons, primary and secondary.
- **Drawer lift** (Tailwind `shadow-xl`, `shadow-lg` on the toast): the phone rail and the undo toast only.
- **Recording pulse** (`0 0 0 7px rgba(206, 43, 34, 0)` cycling from 0.6 alpha): the live-capture indicator in the room, the brief's voice capture, and the sign-in page's live dot.

### Named Rules
**The Two Worlds Rule.** Backstage is flat and tonal. Gradients, grain, glows, and translucent chrome exist only inside the room. The one exception is the skeleton shimmer, a Line-on-Line gradient that reads as texture, not depth.

**The Whisper Shadow Rule.** Backstage shadows never exceed 3px blur or 13% alpha, and never change on hover. If something needs to feel closer, tint it.

## Shapes

Radii come from one base of 14px. Controls are 10px (buttons, room chrome,
dialog actions), fields are 11px, small affordances are 5 to 8px (icon
buttons, the theme toggle, rail items), cards are 20px, and the lane and
counterpart cards on home and the meet card are 25px. Anything that names,
counts, or tags is a full pill: badges, chips, receipts, count bubbles,
avatars. The logo mark is the one square-ish object: a 22 to 32px rounded
box in Ink with a Curtain Red dash. Persona portraits are 5:3 landscape
tiles with 20px corners; initials fallbacks are circles. Borders are one
pixel everywhere; dashed hairlines mark empty states and add-a-file
affordances.

### Named Rules
**The Pill Rule.** Metadata is round. If it is a label, a count, a file, a lane, or a verdict, it is a full pill. Rectangles are for content and controls.

## Components

Quiet and precise. Small type, tight radii, hairline borders. Controls recede until they are needed and never read as chunky objects.

### Buttons
- **Shape:** 10px corners, 10px vertical padding, 17 to 18px horizontal, 13.5px medium text, 8px icon gap.
- **Primary:** Signal Blue fill, white text (dark ink in dark mode), button whisper shadow. Hover deepens to Signal Blue Hover; active scales to 0.98. One per view.
- **Secondary:** Card fill, Line 2 border, Ink 2 text, button whisper. Hover tints to Paper Hover and lifts text to Ink.
- **End Session:** Curtain Red fill, white text, hover to Curtain Red Deep. Exists only in the room and its confirm dialog.
- **Ghost:** no fill, no border, Ink 3 icon; hover tints Paper Hover and darkens to Ink 2. Used for rail actions and the theme toggle, 24px at rest, 36 to 40px on touch.
- **Focus:** a 2px Signal Blue outline offset 2px on every interactive element (`focus-ring`). Disabled drops to 50% opacity.

### Chips
- **Style:** full pill, 6px by 14px padding, 12.5px text, Line 2 border on Card. Touch padding grows to 10px.
- **Selected:** Signal Wash fill, Signal Line border, Signal Blue medium text, `aria-pressed`.
- **Receipt chip:** the same pill with a document icon, 12px text, Ink 2, truncating at 240px with a tooltip past 28 characters.

### Badges
- **Lane badge:** 10px semibold uppercase 0.08em, Paper Hover fill, Line 2 border, Ink 2 text. Colorless by rule.
- **Verdict badge:** 9.5px semibold uppercase 0.07em, amber wash, Warn Line border, Warn text. Same for every tone.
- **Count bubble:** 20px round on Paper Press, tabular 11px, Ink 3.
- **Citation stamp:** mono 9.5px uppercase on Signal Wash with Signal Line border.

### Cards / Containers
- **Corner Style:** 20px; 25px for the home lane cards and the meet card.
- **Background:** Card on Paper, with a Line border.
- **Shadow Strategy:** card whisper always; hover lifts one to two pixels and tints to Paper Hover, shadow unchanged.
- **Panel:** a card with 20px padding whose title is an 11px sans cap on Ink 3 and whose meta is mono 10.5px, separated from the body by 14px.
- **Practice card:** 150px minimum, 17px padding, a full-card focus ring link, a hairline footer row with the lane badge and a Signal Wash "Continue" pill.
- **Empty state:** a dashed Line 2 border, 13px Ink 3 text, centered.

### Inputs / Fields
- **Style:** Card fill, Line 2 border, 11px corners, 11px by 14px padding, 14px Ink text, Ink 4 placeholder. 16px text under 768px.
- **Focus:** border shifts to Signal Line plus the standard focus ring. Autofill repaints to Card.
- **Search:** the same field at 36px height with the card whisper, a leading icon, and a clear button.
- **Textarea:** three rows, vertical resize only.
- **Error:** Destructive border and a 20% red ring from the shadcn base; error copy is 13px on Red text with `role="alert"`.

### Navigation
- **App rail:** 264px, Rail surface. Lane headers are mono caps with a 7px Ink 4 dot and a collapse chevron. Practice rows are 12.5px medium with a truncating name, a to-do count bubble, and pin, archive, and delete ghosts that appear on hover, focus, or touch. Delete's hover goes Curtain Red.
- **Flow rail:** four mono-cap steps centered in the header. Done steps are Ink 3 links, the active step is Signal Blue, upcoming steps are Ink 4. Under 768px only the active step name shows.
- **Mobile:** a Rail-colored header with a 40px hamburger opens the 280px drawer.

### Persona Portrait
The signature object. A 5:3 landscape photograph with 20px corners, a hairline border, and, when chosen, a Signal Blue pill floating at the top center. The signature question sits below in serif italic over a hairline. The fallback is a colorless initials disc with an optional green available dot.

### Room Chrome
Translucent black (60 to 70%) pills and 10px boxes with Line 2 or Signal Blue hairlines, floating at the top center: topic chip, clock, and the sign-off ribbon with its "Keep going" secondary action. All labels here are mono caps at 11px tracked 0.12 to 0.16em on white at 85%.

### Disclosure
The standing honesty line, mono 9.5px uppercase 0.08em on Ink 2 with 1.7 line height, wherever AI output is presented as feedback.

### Dialogs
A centered popup on Card with 20px corners and a one-pixel ring at 10% ink, no shadow, over a 10% black backdrop with a light blur. 100ms fade with a 95% zoom. Confirm is a primary button, cancel is secondary, and End Session's confirm is the one red action in a dialog.

### Toast
The archive undo: an Ink box with 10px corners fixed at the bottom center, 13px Paper text, lifted with `shadow-lg`. Undo is a bold underlined link that takes focus on appearance so keyboard users reach it before the timeout.

### Waiting Screen
The pre-read and blueprint runs. A mono kicker with a pulsing Signal Blue dot, a heading that types out behind a blinking Signal Blue cursor, shimmer skeleton rows (9px bars on a Line gradient), a ticker of one-line reassurances, and a sticky side panel listing the steps. Nothing spins.

### Iconography
Lucide only, 12 to 16px with 14px the default, stroke 2 to 2.5, `currentColor`, always beside a label or with `sr-only` text. An icon never carries meaning alone.

### PDF Exports
The practice report and session debrief render in react-pdf on A4 with 56pt side margins, using the light palette from `src/lib/pdf/theme.ts`, Instrument Sans at 9.5pt body, and Spline Mono stamps at 6.5 to 7.5pt. Print chips add a red "Blocker" tone that has no on-screen counterpart; the on-screen Curtain Rule stands.

## Do's and Don'ts

### Do:
- **Do** keep one filled Signal Blue button per view and let everything else be secondary or ghost.
- **Do** set anything spoken by a counterpart in Source Serif italic, and everything else in Instrument Sans.
- **Do** label with mono caps at 10 to 11px tracked 0.09em on Ink 3; keep sentences out of labels.
- **Do** build depth with Paper, Paper Hover, and Paper Press tints and hairline Line borders; leave shadows at the whisper values.
- **Do** make every metadata element a full pill and every card 20px.
- **Do** ship both themes for backstage using the token aliases, and leave the room on the stage palette in both.
- **Do** grow touch targets to 36 to 40px and reveal hidden-until-hover controls under 768px and on coarse pointers.
- **Do** honor reduced motion: infinite animations off, entrances become instant.

### Don't:
- **Don't** fill anything red except the logo dash and End Session, and never use red for a verdict or a lane. Red stays text-sized: error copy, a blocker dot, a failed-item cross.
- **Don't** give a lane, role, or persona its own color.
- **Don't** bring gradients, grain, glass, or glows backstage. They belong to the room.
- **Don't** introduce numeric scores, progress bars, meters, or traffic-light status. Verdicts are amber pills with words.
- **Don't** raise body type above 15.5px or page titles above 26px backstage; the sign-in headline is the one exception.
- **Don't** grow a shadow on hover. Tint and lift by a pixel instead.
- **Don't** render the wordmark as anything but plain text inheriting its context, and never pair it with a logo beyond the Ink box with the red dash.

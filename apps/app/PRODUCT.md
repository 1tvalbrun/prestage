# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Individuals preparing for a real, high-stakes conversation they will have soon:
a founder about to pitch, a seller with a meeting or a cold call booked, someone
facing a compliance audit, or a candidate with a job interview ahead. They come
alone, with their own materials (a deck, a one-pager, a spreadsheet, a job
description), usually in the days before the real thing. The job is rehearsal
under realistic pressure: find what a real counterpart would find, hear it said
out loud, and leave knowing what to fix.

Stage: invite-only private beta today, with the next surfaces built for public
launch. New surfaces should assume a visitor arriving cold, not an invited
tester who has already been told what this is.

## Product Purpose

Prestage is "the interview before the interview." The user brings a pitch, a
sale, an audit, or an interview; a live, photoreal counterpart reads the
materials, finds what a real one would find, and pushes on it in a spoken
conversation. The session ends the way a real one does, when someone signs off
or time runs out, and produces a debrief: what held, what did not, and to-dos,
with the counterpart's spoken verdict.

Success is the user walking into the real conversation better prepared than
they were, and returning to the same practice to close the items it gave them.

## Positioning

Grounded in your materials. Prestage only pushes on what it can cite. The read
step extracts materials with page, slide, and sheet markers so every later
claim traces to a source. A brief that asserts more than it can support gets a
gap map that says so rather than an invented compliment. This is enforced in
the types: a `Claim` carries a `citation` and there is no shape for one without
it, so an ungrounded assertion can only be demoted to a gap. Intake fills only
the fields it actually heard and flags the rest.

Supporting facts that reinforce the claim but are not the lead: the counterpart
is a live Runway Character with its own voice; a practice remembers across
sessions (working list, gap map, "up from last time" as direction only); the
debrief is qualitative, with no numeric scoring anywhere.

## Operating Context

Four lanes, each a domain pack with its own intake, prep, personas, and
debrief:

- Pitch a startup: choose a VC, a target customer, or a technical architect.
- Pitch a sale: a pitch meeting with a buyer who has read the materials, or a
  two-minute cold call with a prospect who has not. The cold call is its own
  shape: no pre-read, no closing read, no cross-session memory, and its own
  verdicts (Booked, Follow-up granted, Brushed off). A booked call carries the
  seller's brief into a pitch-meeting practice.
- Face an audit: one assessor reading evidence against the controls in scope.
  The catalog is CIS Controls v8.1.2 restated in our own words, a handful of
  safeguards per session. Verdicts are practice readiness, never a compliance
  opinion.
- Practice an interview: choose a recruiter, a hiring manager, or a senior
  practitioner. The interviewer builds a role-specific blueprint first, asks
  clarifying questions, and keeps its question plan and rubric sealed until
  the room.

The flow rail shows four steps: Brief, Pre-read (Blueprint in the interview
lane), Counterpart, Room. The debrief is not a step; it lands on the session page in
the workspace when the room ends.

- Brief: typed or spoken. A spoken brief is transcribed and shaped into the
  lane's fields. Materials are PDF, PPTX, XLSX, or DOCX, up to 10 MB each and
  10 per practice; files are deleted once extracted.
- Pre-read: materials are read with source markers, then audited into claims
  and gaps. Adding a document re-runs the pre-read on the full set and marks
  the gaps it closed.
- Counterpart: meet who you face, or choose in the founder and interview
  lanes, then run a mic and noise check.
- Room: a live spoken conversation, always dark, with the user's own camera
  tile, a topic chip, a wall clock, a transcript panel, and live notes. The
  clock is five minutes (two for the cold call). The ending is server-owned:
  a sign-off ribbon with "Keep going" catches a goodbye, and the room lands
  on a verdict, a goodbye, the clock, an idle timeout, an exit, or an error.
- Debrief: what happened, what held up (quotes with a why), what didn't (with
  refs), verify items when the session touched regulated territory, and the
  spoken verdict. Three states: pending, nothing recorded, complete. The
  transcript opens in a modal; the debrief exports as PDF.

The core noun is a practice: a persistent thread with one lane and one persona,
holding the confirmed brief, attached materials, the working list (a one-way
"to work on" list with a completed drawer), and the gap map ("still
unproven"). A practice contains sessions, each one room conversation ending in
a debrief.

Workspace surfaces around the flow:

- Welcome: the first screen for an invited user. Pick the lanes you are
  preparing for and accept the terms and privacy policy.
- Home: a grid capped at nine practices, "Find a practice" search, a start
  link per lane, pinned practices, archive with undo, delete, and a separate
  archived page.
- App rail: a sidebar that folds and pins.
- Practice hub: brief, materials with add and re-run, gap map with closed
  gaps, working list, and session history.
- Settings: account, enable or disable lanes, legal links, and a danger zone
  that deletes the account and all data.
- Terms and privacy pages.

Usage scene: a person alone at a laptop with a working microphone and camera,
often on a deadline. Workspace pages have had a mobile and tablet pass; the
flow rail hides step labels on small screens. The room is a real-time audio
and video conversation, so connection quality and mic state are part of the
product. Consent is the terms clickwrap at welcome plus a standing notice on
the counterpart stage that entering the room consents to transcription and
possible recording; the privacy policy says the same.

## Capabilities and Constraints

- Stack: Next.js 16, TypeScript strict, Tailwind CSS v4 (theme in
  `src/app/globals.css`, no tailwind config file), shadcn/ui, Convex (database,
  server functions, realtime, crons), Clerk (auth, invite-only Restricted mode,
  Google and email code sign-in), Runway Characters via
  `@runwayml/avatars-react`, AssemblyAI streaming transcription, OpenAI for the
  read, audit, orchestration, and debrief. Deployed on Vercel.
- Every page, API route, and public Convex function requires a session, and
  each user sees only their own practices, sessions, and debriefs.
- Light and dark themes with a toggle; the room is always dark.
- One avatar session per room, one-on-one with the chosen persona. The avatar's
  personality lives on the Runway Character; the app supplies a per-session
  preamble and start script.
- Avatars are registered per persona per deployment from the CLI; the connect
  route only mints sessions for registered avatars.
- The room has a fixed time budget and a server-owned ending (sign-off protocol
  or clock).
- Terminology in the product: practice, session, lane, counterpart (the
  photoreal persona you face; lane copy uses the role word: investor, buyer,
  prospect, assessor, interviewer; "panel" and "panelist" never appear),
  brief, pre-read, blueprint (interview lane), gap map, working list,
  debrief, verdict. Internal stage keys and route names
  differ from the visible stage names; the mapping lives in
  `src/components/simulation/flow/FlowShell.tsx`.
- Domain packs are the extension point: a new lane is a new pack module, not
  new engine code.
- Cast: 9 personas in the product, one per role (three in the founder lane,
  two in sales, one in audit, three in interview), defined in
  `src/domains/*/personas.ts`. There is no face picker. Photos for 27 faces sit
  in `public/avatars/` (slug named, newer ones 16:9 for the landscape counterpart
  tile) with personality text and voice descriptions in `docs/cast/`, prepared
  as Runway Characters; every face in a role carries the same personality.
- Heritage or ethnicity labels for cast members exist only in design notes and
  never appear in the product, a persona bio, or a personality.
- Undecided, do not invent: pricing, plans, and any public-launch onboarding
  beyond the current invite flow. Legal entity: terms and privacy name Mayday
  Media LLC as a placeholder; Prestage Inc. is planned once formed, so never
  design around the current name. CIS commercial license: pending; until
  granted, no CIS logo, badge, or verbatim CIS text on any surface.

## Accessibility & Inclusion

The room needs a microphone and camera; that dependency is inherent. Every
other surface (brief, pre-read, blueprint, practice hub, working list,
debrief, exports, settings) must be fully usable without audio, by keyboard,
and with a screen reader. The room's forced dark theme still meets contrast.
Target: WCAG AA, as set in `docs/engineering-standards.md`.

## Brand Commitments

- Name: Prestage, rendered as a plain wordmark that inherits the surrounding
  text style (`src/components/shared/BrandName.tsx`). The earlier working name
  Redline is retired and must not appear.
- Tagline: "The interview before the interview."
- Domain: prestageprep.ai, social handle prestageprep. The app name stays
  Prestage, never Prestage Prep.
- Voice: plain, direct, second person, honest about limits. A gap is a finding,
  not a failure. No hype, no invented praise, no numbers standing in for
  judgment.
- The AI disclosure line ("AI-generated practice simulation. It can be wrong.
  Not professional advice. Verify anything important independently.") renders
  wherever AI output is presented as feedback, in every lane.
- No numeric scoring anywhere in the product. Verdicts are qualitative tiers
  (three per lane, one good, one mid, one bad); progress is shown as direction
  only.

## Evidence on Hand

- Real product content: lane copy, intake fields, persona bios and signature
  questions, pre-read and debrief structures, all in `src/domains/`.
- Cast photography for every persona in `public/avatars/`.
- Type: Instrument (sans and display), Source Serif (signature quotes), Spline
  Mono (labels); tokens in `src/app/globals.css`.
- No logo asset file exists. The in-app mark is drawn in CSS in
  `src/components/shared/LogoMark.tsx`: an ink box with a red dash, shown
  beside the wordmark in the rail, the flow header, and sign-in.
- Absent, and must not be fabricated: any other logo or mark, tester quotes
  or testimonials, customer or partner logos, usage numbers, outcome claims,
  press, pricing.

## Product Principles

- Only say what you can cite. Every claim the product makes about the user's
  materials traces to a source; everything else is a gap, shown as a gap.
- Pressure is the product. The counterpart pushes back the way a real one
  would; comfort is not the goal, readiness is.
- The debrief is the deliverable. Everything before the room exists to make the
  room sharp, and everything after it exists to make the next real conversation
  better.
- A practice is a place you return to. Continuity across sessions matters more
  than any single session.
- Honest about being a simulation. The disclosure is standing copy, endings are
  real endings, and nothing pretends to be professional advice.

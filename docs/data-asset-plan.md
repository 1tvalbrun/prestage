# Prestage data-asset audit and implementation plan

Status: Phase 1 and 2 are done. This is a read-only report, and nothing in it has been
implemented. Every claim about current behavior cites `file:line` against the working tree
on `feature/counterpart-casts` as of 2026-10-20, including uncommitted changes. Where the
code cannot settle a question, the plan says so and lists it under Vendor questions or Open
questions.

All legal and disclosure text here is **DRAFT FOR COUNSEL**. It is not final language, and
none of it should ship before an attorney reviews it.

---

## 1. Executive summary

### Top risks

1. **The current terms forbid the target use.** Privacy says data is used "Solely to run the
   service" (`src/app/privacy/page.tsx:38`). Terms grant only "the limited license needed to
   operate the service" (`src/app/terms/page.tsx:37-39`). Nothing in either covers training,
   research, licensing, or transfer of the data itself. Every existing record was collected
   under that promise. Using it for training would require a retroactive terms change, which
   is the pattern FTC staff has warned against.
2. **Deletion does not match the promise.** `usageEvents` survive both account deletion and
   practice deletion (`convex/users.ts:70-103`, `convex/practices.ts:455-476`). There is no
   `by_user` index to find them (`convex/schema.ts:310`). Dev already holds 155 usage rows
   pointing at deleted practices. Both deletes also run as a single unbounded transaction,
   which will fail once a user has enough data.
3. **The most valuable raw signal is discarded at capture.** The spoken intake pitch exists
   only in React state (`src/app/(flow)/simulation/new/page.tsx:123-137`). Raw model output is
   never stored; the code says so itself (`src/lib/debrief.ts:164-167`). Avatar audio-onset
   timing and user turn end times are measured in the browser and then thrown away
   (`src/lib/founderTranscription.ts:17-19, 93-96`,
   `src/components/simulation/room/SessionStatusBridge.tsx:44-53`).
4. **Prep artifacts are overwritten in place.** The audit, blueprint, continuity, and Runway
   session id all keep only the latest value (§B). A session therefore cannot be replayed
   against the prep it was actually briefed with.
5. **No consent state exists beyond one clickwrap version.** `users.termsVersion` is set once
   and never re-prompted (`convex/users.ts:37-45`). The schema comment says bumping the
   version re-prompts users (`convex/schema.ts:123`), but no code does that. Nothing is
   recorded per practice or per session.
6. **The processor list is incomplete.** The app is deployed on Vercel (`vercel.json:2`),
   but Vercel is not on the processor list (`src/app/privacy/page.tsx:46-52`). Convex
   logs also receive user content: `src/lib/debrief.ts:170-173` logs up to 500 characters of
   model output.

### Top gaps against the target state

- Missing: consent ledger, raw-input retention for speech, AI call log, version history,
  turn table with timing, hidden assessment, event capture, outcomes, feedback, product
  events, admin dashboard.
- Partial: deletion, deck-text retention (`materials.text` survives; autofill-only uploads
  do not), prompt organization (prompts live in modules and are pinned by tests, but carry
  no version).

### What the beta data is worth

Prod holds 8 users, 9 practices, 7 sessions, and 2 debriefs (§I). All of it was collected
under terms version `2026-08-03`, and none of it with training consent. Excluding it from
training costs essentially nothing, so the plan treats it as permanently excluded (§14).

---

## 2. Phase 1 inventory

### A. Data inventory

Legend: **W** = where written. **Overwrite** = replaced in place. **Delete** = deleted by
what.

#### `users` (`convex/schema.ts:117-126`)

| Field | Stores | W | Overwrite | Delete |
|---|---|---|---|---|
| clerkId | Clerk subject | `convex/users.ts:39` | never | `users.deleteAccount` (`users.ts:102`) |
| displayName | Clerk name at onboarding | `users.ts:40` | never (stale if renamed at Clerk) | same |
| lanes, defaultLane | Lanes enabled | `users.ts:41-42`, `addLane` `users.ts:62` | lanes append-only | same |
| termsAcceptedAt, termsVersion | One clickwrap record | `users.ts:43-44` | never; no re-accept path exists | same |

#### `avatars` (`schema.ts:132-138`)

Persona to Runway Character mapping. Written only by the CLI `avatars.register`, which
upserts in place (`convex/avatars.ts:31-35`). No user data.

#### `practices` (`schema.ts:143-204`)

| Field | Stores | W | Overwrite | Delete |
|---|---|---|---|---|
| userId, name, packId | Owner, title, lane | `practices.ts:182-190` | never | `practices.remove` (`practices.ts:474`), `deleteAccount` (`users.ts:89`) |
| scope | The user's typed or confirmed brief | `practices.ts:187` | **never patched** (only `insert`; confirmed by grep) | same |
| context | Read-stage extraction | `setContext` `practices.ts:598-607` | once only (`claimRead` refuses when present, `practices.ts:252`) | same |
| cast, personaId | Drawn faces, chosen face | `practices.ts:188-189`, `sessions.ts:153`, `ensureCast` `practices.ts:522`, `faceAgain` `practices.ts:577` | yes (`faceAgain`) | same |
| audit {status, claims, gaps, closed, claimedAt, failureReason} | Evidence audit | `claimAudit` `practices.ts:741-748`, `setAuditOutcome` `practices.ts:802-818` | **yes, replaced every run** | same |
| blueprint | Interview prep plus sealed plan | `blueprints.ts:57-63, 89-95, 105-118, 293-299` | **yes** | same |
| continuity {lastSessionSummary, actionItems, updatedAt} | Cross-session memory | `recordContinuity` `practices.ts:985-991`, `setActionItemStatus` `practices.ts:1012-1026` | **yes; settled items truncated at 30** (`practices.ts:33, 981-984`) | same |
| sessionCount, lastSessionAt, lastVerdict, lastQuote, lastVerdictSessionAt | Rollups | `sessions.ts:96-99, 588-595` | yes (derived) | same |
| pinned, archivedAt, status, readClaimedAt | UI and claim state | various | yes | same |

#### `sessions` (`schema.ts:208-292`)

| Field | Stores | W | Overwrite | Delete |
|---|---|---|---|---|
| practiceId, userId, persona{...} | Persona snapshot at insert | `sessions.ts:77-93` | never | `practices.remove` `practices.ts:465`, `deleteAccount` `users.ts:96` |
| transcript[] | Embedded turns (§D) | `addTranscriptEntry` `sessions.ts:254` | append, but the whole array is rewritten per patch; capped at 240 | same |
| liveNotes[] | Orchestrator notes | `sessions.ts:528-530` | append | same |
| currentTopic | Topic chip | `sessions.ts:538` | yes | same |
| signOff, signOffDismissedAt | Sign-off stamp | `sessions.ts:429, 436, 448` | yes, can be cleared | same |
| lastOrchestratedAt, lastSignOffCheckAt, debriefClaimedAt | Throttles | `sessions.ts:383, 405, 565` | yes | same |
| connectMs | Connect latency | `sessions.ts:346` | once | same |
| micCheck | Pre-room noise and voice dB | `sessions.ts:89` | once | same |
| roomStartedAt, roomMs | Room clock | `sessions.ts:88, 345` | once | same |
| roomClientId | Latest tab | `usage.ts:101` | yes | same |
| runwaySessionId | Latest Runway realtime id | `sessions.ts:356-361` | **yes, every connect** | same |
| status, endedAt, endedReason | Conclusion | `sessions.ts:316-320, 578-582` | once | same |
| debrief | Parsed debrief | `setDebrief` `sessions.ts:572-598` | never (patch-if-absent, `sessions.ts:577`) | same |
| closeDeliveredAt | Retired | nothing (`schema.ts:246-248`) | n/a | same |

#### `usageEvents` (`schema.ts:301-310`)

One row per paid call: userId, practiceId?, sessionId?, kind, model, inputTokens,
outputTokens, costUsd. Written by `usage.record` (`usage.ts:23-39`) and
`claimAvatarConnect` (`usage.ts:102-108`). Never overwritten. **Never deleted by any code
path**, and there is no `by_user` index.

#### `materials` (`schema.ts:316-331`)

| Field | Stores | W | Overwrite | Delete |
|---|---|---|---|---|
| practiceId, name, fileType, size | Upload metadata | `practices.ts:59-66` | never | `practices.remove` `practices.ts:470-473`, `deleteAccount` `users.ts:81-88` |
| storageId | The file, while extracting only | `practices.ts:61` | **cleared after extraction** (`materials.ts:68-69`) | blob deleted at extraction |
| text | Extracted text, clamped at 80,000 chars (`src/lib/materials.ts:8, 64-66`) | `materials.ts:69` | once | as above |
| status, failureReason | Extraction outcome | `materials.ts:69` | once | as above |

#### `_storage`

Upload blobs. Deleted at extraction (`materials.ts:68`). Orphans (abandoned intake uploads,
autofill-only uploads) are deleted by the hourly sweep once they are 24 hours old
(`convex/crons.ts:8`, `materials.ts:76-94`). Blobs carry no owner.

#### Generated, then discarded

| Data | Where it lives briefly | Evidence |
|---|---|---|
| Spoken intake pitch transcript (up to 90s) | React state, passed to `extractScope`, dropped | `TellIt.tsx:10, 30-32`; `new/page.tsx:123-127`; `extractScope` writes nothing but usage (`practices.ts:683-721`) |
| Extracted scope "heard" from voice, before user edits | `ConfirmBrief` state; only the final edited scope is stored | `ConfirmBrief.tsx:41`; `new/page.tsx:132` |
| Deck text extracted for autofill | Returned only as scope; the text is dropped in `scopeFromUpload` | `convex/ingest.ts:84-99`. It is re-extracted into `materials.text` **only if** the upload is submitted with the practice (`new/page.tsx:147`) |
| Which fields were AI-inferred vs typed | Client `inferredKeys` | `src/lib/autofill.ts:16-30` |
| Raw model output, every call | Parsed, then dropped | `practices.ts:642-661, 905-911`; `blueprints.ts:210-215`; `orchestrator.ts:96-104`; `sessions.ts:497-504, 718-728`; acknowledged at `src/lib/debrief.ts:164-167` |
| Items the parsers drop | Silent, except one `console.warn` | ungrounded `heldUp` quotes (`debrief.ts:93-96`); unparseable action items (`debrief.ts:169-174`, warn); claims demoted to gaps (`audit.ts:109-122`); caps (`audit.ts:103, 127`); invalid note types (`orchestrator.ts:107-118`); malformed sign-off output (`sessions.ts:502-504`) |
| Composed Runway personality and startScript | Sent to Runway, never stored | `avatars.ts:181-245` |
| Rendered prompts (all calls) | Never stored | all call sites in §C |
| User turn end time | AssemblyAI `words[].end` parsed, then ignored | `founderTranscription.ts:17-19, 93-96` |
| Interim transcripts and their count | Discarded | `UserSpeechBridge.tsx:22-27, 79`; `usePitchTranscription.ts:48` |
| Avatar isSpeaking edges | React state only | `SessionStatusBridge.tsx:44-53`; `RoomShell.tsx:198` |
| Last-heard-user time | Ref only | `RoomShell.tsx:179` |
| Echo-filtered, capped, and late turns | Dropped server-side, no record | `sessions.ts:232-251` |
| Turns whose write failed | Dropped client-side | `TranscriptBridge.tsx:75`; `UserSpeechBridge.tsx:68` |
| Earlier Runway session ids on reconnect | Overwritten | `sessions.ts:354-360` |
| Model error text | `console.error` only | `practices.ts:920`; `blueprints.ts:226` |

### B. Overwrite and loss points

| Item | Behavior | Citation |
|---|---|---|
| Audit claims, gaps, closed | `setAuditOutcome` replaces them. The previous map survives only *during* a run; a successful re-run destroys it. `closed` holds only the latest re-run's resolutions. | `practices.ts:739-743, 802-818` |
| Blueprint | `setOutcome` replaces all content. A refinement pass discards its own clarifying questions. Refinement inputs (answers, removed themes, redirect note) are kept only on the latest blueprint. | `blueprints.ts:98-118, 293-299` |
| Continuity | The summary is replaced each debrief, and settled items beyond 30 total are deleted. Reopening an item clears `settledAt`. | `practices.ts:981-990, 1020` |
| Extracted claims and gaps | Same as the audit. Gaps have no stable id (array index only, `AuditStage.tsx:224`). | |
| runwaySessionId | Overwritten on each of up to 5 connects. Earlier Runway conversation records lose their only reference. Prod: only 2 of 7 sessions have one at all. | `sessions.ts:278-281, 356-361`; `usage.ts:72` |
| 240-turn cap | Turns beyond 240 are silently refused. No real session has reached it (max 39 prod, 34 dev). | `sessions.ts:49-52, 238` |
| Material files | Deleted when extraction settles; only the clamped text is kept. No material versions; a re-upload is a new row. | `materials.ts:64-69`; `schema.ts:312-315` |
| Material text truncation | Text beyond 80k chars is cut with `[truncated]`. | `src/lib/materials.ts:64-66` |
| signOff | Cleared when the conversation continues or the user dismisses it. | `sessions.ts:429, 448` |
| Terms acceptance | Single version, never re-recorded. | `users.ts:37` |

### C. AI call map

No call records latency. No prompt carries a version. Prompts live in git; the founder
prompt module says tests pin its load-bearing lines (`src/domains/founder/prompts.ts:11-14`).
Model tiers come from `src/lib/openai.ts:10-30`. Prod usage shows `gpt-5-nano` and
`gpt-5-mini` in use (§I).

| Call | Purpose | Tier | Prompt lives | Persisted |
|---|---|---|---|---|
| `practices.analyze` (`practices.ts:609-677`) | Read stage: brief to context fields | fast | `src/domains/<lane>/prompts.ts` `analyzeSystem`/`analyzeUser` | parsed `context`; usage (model, tokens). A parse failure throws and reverts to draft (`practices.ts:658, 673`) |
| `practices.extractScope` (`practices.ts:683-721`) | Voice or deck to partial scope | fast | `prompts.ts` `extractScope` + `DECK_EXTRACTION_CAUTION` (`src/lib/intake.ts:9`) | usage only, **no practiceId** (`practices.ts:709-715`). Input and output go back to the client |
| `ingest.scopeFromUpload` (`ingest.ts:78-100`) | Deck autofill; calls `extractScope` | fast | same | same; deck text dropped |
| `generateAudit` (`practices.ts:822-923`) | Evidence audit | quality | `pack.prep.prompt` in `src/domains/{founder,sales,audit}/prompts.ts` | grounded claims, gaps, and closed; usage. Drops are silent |
| `generateBlueprint` (`blueprints.ts:140-229`) | Interview plan and refine | quality | `src/domains/interview/prompts.ts` (`prep.prompt`, `prep.refine`) | parsed blueprint; usage. Parse failure stores a fixed message, raw output lost |
| `orchestrator.decide` (`orchestrator.ts:24-129`) | Live note and topic | fast | `prompts.ts` `orchestrate` | note, topic; usage |
| `sessions.checkSignOff` (`sessions.ts:458-518`) | Sign-off detection | fast | `SIGN_OFF_PROMPT` `src/lib/signOff.ts:74` | `signOff` stamp; usage |
| `sessions.generateDebrief` (`sessions.ts:600-761`) | Debrief, verdict, continuity | quality | `prompts.ts` `debrief` + `VERDICT_RESTATE_DIRECTIVE` `src/lib/ending.ts:61` | parsed debrief, continuity; usage |
| `avatars.mint` to Runway `POST /v1/realtime_sessions` (`avatars.ts:220-246`) | Panelist session | n/a (`gwm1_avatars`) | `pack.turnTaking` + `src/domains/<lane>/briefing.ts` + the Character's stored personality (`docs/cast/personalities/*.md`, pushed by `scripts/push-personalities.ts`) + `endingContract` (`src/lib/ending.ts`) | latest Runway id only; connect usage ($0.02 flat); `connectMs` |
| `avatars.fetchStoredPersonality` (`avatars.ts:63-85`) | Read the Character personality | n/a | n/a | nothing |
| AssemblyAI streaming (`src/lib/founderTranscription.ts:202-232`, token `src/app/api/transcribe/token/route.ts`) | User speech to text, browser-direct | Universal-Streaming, `language_codes=en` | n/a | final text plus onset only (§D) |
| `scripts/eval-signoff.ts` | Offline sign-off eval | fast | `SIGN_OFF_PROMPT` | stdout only |

Inputs sent: the analyze prompt receives the scope. The audit and blueprint prompts receive
the scope plus up to 60k chars of material text (`practices.ts:34, 859-869`;
`blueprints.ts:33, 122-138`). The debrief receives the scope, the last 60k chars of
transcript, live notes, continuity, and the sealed rubric (`sessions.ts:644-702`). Runway
receives the scope, top gap titles, continuity, the sealed blueprint, and on reconnect a
transcript digest (`avatars.ts:181-190`; `src/domains/founder/briefing.ts:40-49`).

### D. Turn data

Per entry (`schema.ts:219-231`):

- `speaker`: client-supplied string. It is read only as a React key
  (`TranscriptPanel.tsx:88`) and duplicates `type`.
- `speakerName`: client-supplied display name, rendered as-is (`TranscriptDialog.tsx:79`).
- `text`: clamped to 4000 chars (`sessions.ts:48, 253`).
- `timestamp`: **client** `Date.now()` at write (`TranscriptBridge.tsx:66`;
  `UserSpeechBridge.tsx:52`). Not server-stamped.
- `spokenAt`: client-measured onset, optional.
  - User turns: audio anchor plus `words[0].start` (`founderTranscription.ts:84, 93-96, 321`).
  - Avatar turns: arrival time of the first *text chunk* since the last commit
    (`avatarTurns.ts:22-26`; `TranscriptBridge.tsx:98`). This is not audio onset.
- `type`: `user` or `panelist`.

Not stored: end time, latency, overlap or barge-in, interim count, word count, server
receive time, and the turn ordinal (arrival order is implicit in the array).

How speech state is tracked:

- **User speech** goes through AssemblyAI VAD. Only finals are written
  (`UserSpeechBridge.tsx:44-58, 75-79`). Interims only feed `onHeard` for the idle rule
  (`RoomShell.tsx:179`).
- **Avatar isSpeaking** comes from LiveKit `participant.isSpeaking` and `isSpeakingChanged`
  (`SessionStatusBridge.tsx:44-53`), held in `RoomShell` state (`RoomShell.tsx:198`). It is
  used to commit avatar lines on its falling edge (`TranscriptBridge.tsx:83-90`) and for
  landing math. It is never persisted.

### E. Disclosure and consent audit

Quoted text is current as of terms version `2026-08-03` (`src/lib/legal.ts:4`). One
version string covers both Terms and Privacy (`LegalShell.tsx:16`).

| Topic | Current language |
|---|---|
| Ownership | "You own what you bring: your ideas, uploads, and what you say in sessions." (`terms/page.tsx:37`). Output: "The transcripts, feedback, and reports the service generates for you are yours to keep and use." (`terms/page.tsx:44-45`) |
| License | "You grant us the limited license needed to operate the service: storing your content, processing it with the AI providers listed in the Privacy Policy, and generating your feedback and reports." (`terms/page.tsx:37-40`) |
| Training, research | **Absent.** Contrary language: "Solely to run the service…" (`privacy/page.tsx:38`); "We do not sell your data or use it for advertising." (`privacy/page.tsx:33`) |
| Transfer on change of control | Terms only: "we may assign them in connection with a merger, acquisition, or sale of assets." (`terms/page.tsx:114-115`). Nothing about data or the license surviving |
| Audio and voice | "your audio during a live session is streamed to run the conversation, and our avatar provider may create a recording of the session on its systems." (`privacy/page.tsx:29-30`). In-app: "Entering the room is your consent to your audio being transcribed and the conversation being processed, and possibly recorded, by our avatar provider to run the session." (`PanelSetup.tsx:124-125, 335`). **No notice on the intake voice pitch** (`TellIt.tsx`), although it streams audio to AssemblyAI |
| Processors | Clerk, Convex, OpenAI, Runway, AssemblyAI (`privacy/page.tsx:46-52`). **Vercel absent** |
| Retention | "kept so your history and progress work, until you delete it." Processors "expire under their own retention policies" (`privacy/page.tsx:69-73`, `54-56`). No periods are stated |
| Deletion | "permanently removes your ideas, uploads, transcripts, reports, and profile from our database and file storage." (`privacy/page.tsx:70-71`). Settings: "permanently removes your practices, uploads, session transcripts, and debriefs." (`settings/page.tsx:121-123`) |
| Follow-up contact | **Absent** |
| Changes | Terms: "continued use after a change is acceptance of it. For material changes we will ask you to review and accept again." (`terms/page.tsx:98-100`). No re-accept mechanism exists in code |

Acceptance is a single checkbox for Terms and Privacy combined on `/welcome`
(`welcome/page.tsx:79-105`). The server records `termsAcceptedAt` and
`termsVersion = TERMS_VERSION` on first onboarding only (`users.ts:43-44`), and `/settings`
displays it (`settings/page.tsx:113-115`). No consent state is stored per practice or
per session.

### F. Deletion audit

**Account deletion** (`users.deleteAccount`, `users.ts:70-103`). This is one mutation, one
transaction, with every index read `.collect()`ed.

| Data | Deleted? | Mismatch with the promise |
|---|---|---|
| practices (including audit, blueprint, continuity) | yes, `users.ts:76-90` | none |
| materials and their blobs | yes, `users.ts:81-88` | none for attached files |
| sessions (transcripts, debriefs) | yes, `users.ts:92-96` | none |
| users row | yes, `users.ts:98-102` | none |
| **usageEvents** | **no** | holds userId, practiceId, sessionId, and kind; it survives as per-user activity history. Not "content", but personal data tied to the user id. Dev shows 155 rows referencing deleted practices and 140 referencing deleted sessions |
| Abandoned and autofill-only upload blobs | no; up to 24h until the sweep | conflicts with "removes … uploads … from our … file storage" (`privacy/page.tsx:70-72`) |
| Convex logs (e.g. `debrief.ts:170-173` logs model output) | no | not disclosed |
| Live Runway session | not released | minor |
| Runway, OpenAI, AssemblyAI copies | no vendor deletion call | disclosed as "expire under their own retention policies" |
| Clerk account | no, by design | disclosed (`privacy/page.tsx:73-74`) |

**Practice deletion** (`practices.remove`, `practices.ts:455-476`). Sessions, materials, and
the practice are deleted. usageEvents survive. A live session's Runway session is not
released.

**Scale risk.** A single-transaction cascade will exceed Convex per-mutation read and write
limits once turns, aiCalls, and versions exist. Deletion must become a batched, scheduled
job (§11).

Copy inconsistency: Privacy says "ideas" (`privacy/page.tsx:70`), a pre-rename table name.

### G. Vendor data

| Vendor | What we send | What we keep | Retention or opt-out settings in code |
|---|---|---|---|
| Runway | The composed personality and startScript (the scope, gap titles, sealed blueprint, continuity, transcript digest on reconnect); live user audio and video over LiveKit | latest `runwaySessionId` only (`sessions.ts:281`). The schema comment says it "keys Runway's post-session conversation record (transcript + tool-call history)" (`schema.ts:278-279`). **No code reads that record**, and the repo cannot confirm whether a video or audio recording exists | none. Sessions are DELETEd on end (`avatars.ts:277-291`); whether DELETE removes recordings is unknown |
| AssemblyAI | Raw mic PCM, browser-direct, intake pitch and room (`founderTranscription.ts:210-221`) | final text plus onset | token TTL 60s (`token/route.ts:24`); no retention or opt-out parameter is passed |
| OpenAI | Everything listed in §C | parsed output plus tokens | **no `store`, `metadata`, or ZDR configuration** in any call. Defaults are unverified here |
| Vercel | Hosts Next routes: auth tokens, export PDFs, function logs (`console.warn` in routes) | n/a | not disclosed |
| Convex | Everything | everything | log retention unknown |
| Clerk | name, email | | |

### H. Dead or inconsistent schema

| Item | Finding | Citation |
|---|---|---|
| `sessions.closeDeliveredAt` | Never written or read; 1 dev doc still carries it, 0 prod | `schema.ts:246-248`; comment-only refs `src/lib/ending.ts:6, 27` |
| `transcript[].speaker` | Read only as a React key; duplicates `type` | `TranscriptPanel.tsx:88` |
| `transcript[].speakerName` | Client-supplied, derivable from `type` and `persona.name` | `sessions.ts:213-214` |
| `transcript[].timestamp` | Client clock, used as server-side ordering fallback and idle evidence | `sessions.ts:285`; `src/lib/transcript.ts:11-12` |
| `materials.size` | Written, never read | `practices.ts:64` |
| `sessions.connectMs`, `sessions.micCheck` | Write-only; stated calibration purpose with no reader | `schema.ts:46-48, 265-268` |
| TERMS_VERSION re-prompt | The comment promises it; no code implements it | `schema.ts:123`; `legal.ts:1-3` |
| `usageEvents` comment "quota enforcement adds by_user" | No by_user index, so deletion cannot find rows | `schema.ts:298-300` |
| CLAUDE.md data notes | Refer to `ideas/simulations/rooms/reports` and "inherit ownership from their simulation"; the actual tables are practices and sessions | `CLAUDE.md` Key Decisions |
| Dev deployment tables | `ideas`, `simulations`, `rooms`, `reports`, `audits` exist (all 0 rows), not in schema | `npx convex data` (dev) |
| Abandoned sessions | No state; "stale" is derived at read time and a silent room never goes stale | `src/lib/session.ts:1-6` |

### I. Beta data status

Read-only aggregate counts were taken on 2026-10-20 with `npx convex data` (no field values
printed).

| | Prod | Dev |
|---|---|---|
| users | 8 (all `termsVersion 2026-08-03`) | 2 (same) |
| practices | 9 (7 owners; sales 5, interview 3, audit 1) | 9 (sales 8, audit 1) |
| sessions | 7 (2 with debrief; endedReason user 3, error 3, none 1; 2 with ≥10 user turns; max 39 turns) | 32 (22 debriefs) |
| materials | 4 (all ready, no stored files) | 3 |
| usageEvents | 66 (models gpt-5-nano, gpt-5-mini) | 661 (155 orphaned) |
| sessions with runwaySessionId | 2 of 7 | 31 of 32 |
| date range | 2026-08-18 to 2026-09-03 | 2026-08-04 to 2026-09-24 |

**Training consent: none.** Every record was collected under language that limits use to
running the service (§E).

---

## 3. Gap table

The effort column uses S, M, and L.

### Cross-cutting conventions (apply to every design below)

- **Auth.** Every public function calls `requireIdentity`. Single-doc reads go through
  `ownedOrNull`. New internal-only tables (aiCalls, assessments, monthlySnapshots) have
  **no public query at all**. Admin reads use `requireAdmin` in `convex/guard.ts`, built on
  `requireIdentity`: it compares `identity.subject` to the `ADMIN_CLERK_ID` Convex env var
  and fails closed when that var is unset.
- **Ownership.** Every new user-data table carries `userId` (stamped server-side from the
  owning doc or identity) and a `by_user` index. That index is what the deletion cascade
  walks.
- **Large payloads.** A shared `blobRef` validator holds either `{ inline: string }` (≤32 KB)
  or `{ storageId: Id<"_storage">, bytes: number, sha256: string }`. Actions write the blob
  with `ctx.storage.store` before inserting the row. Nothing grows in an unbounded array.
- **Never trust client timing.** Client-measured times are stored as-is but labeled
  client-measured, clamped to the session window, and paired with a server `receivedAt`.
- **Fail soft on logging.** Like `recordUsage` (`usage.ts:41-60`), a failed log or event
  write never fails the feature.

| # | Item | Status | Effort |
|---|---|---|---|
| 1 | Consent on the record | Missing | M |
| 2 | Retain raw inputs | Partial | S–M |
| 3 | Log every AI call raw | Missing | M |
| 4 | Append-only history | Missing | M |
| 5 | Transcript and turn timing | Partial | L |
| 6 | Hidden internal judgment | Missing | S–M |
| 7 | Real event capture at intake | Partial | S |
| 8 | Outcome loop | Missing | M–L |
| 9 | Feedback signal | Missing | M |
| 10 | Product events | Missing | S–M |
| 11 | Deletion that matches the promise | Partial | M |
| 12 | De-identification (design only) | Missing | design S |
| 13 | Data-asset dashboard | Missing | L |
| 14 | Beta data handling | n/a | S |
| 15 | Housekeeping | n/a | S |

### 1. Consent on the record (Missing, M)

**What's missing.** Only the single clickwrap record exists (`users.ts:43-44`).

**Schema.**

- `consentEvents` (append-only): `{ userId, kind: "training" | "outcomeFollowups" |
  "audioRetention" | "research", granted: boolean, version: string, source: "onboarding" |
  "settings" | "reconsent" | "practice_override" }`.
  - Indexes: `by_user_kind ["userId","kind"]`, ordered by `_creationTime`.
  - Current state is **derived**: the latest event per kind, four `.first()` reads in desc
    order. There is no mutable "current" copy, which keeps one source of truth.
- `CONSENT_VERSION` constant in `src/lib/legal.ts`, separate from `TERMS_VERSION` and a new
  `PRIVACY_VERSION`, so each document re-versions independently.
- `consentSnapshotValidator`: `{ version, training, outcomeFollowups, audioRetention,
  research, orgNeverTrain, laneExcluded, capturedAt }`.
  - Added as optional `consent` on `practices` and `sessions`.
  - Written at insert only, in `practices.create` and `insertSessionForPersona`
    (`sessions.ts:63`). Never patched.
- `orgPolicies`: `{ clerkOrgId, neverTrain, setAt }`. Written only by internal CLI. The
  snapshot reads it when the identity carries an org claim. No orgs exist yet, so this
  table plus the snapshot field is the entire build.

**Derived rule.** `trainingEligible(snapshot)` is a pure function in `src/lib/consent.ts`:

```
snapshot?.training === true && !snapshot.orgNeverTrain && !snapshot.laneExcluded
```

A missing snapshot means false. This fails closed by construction.

**Audit lane.** Audit materials routinely contain a third party's (the auditee's)
confidential data that the user cannot license to us. Recommendation: set
`pack.trainingDefault = "excluded"` for the audit lane, so `laneExcluded = true` unless the
user ticks a per-practice "include this practice" box at intake. Every lane also gets a
per-practice "keep this practice out of training" override, which can only *restrict*.

**Writes.**

- `consent.set` is a public mutation: requireIdentity, kind validated by union, version
  taken from the server constant (never from the client), inserts one event.
- `users.completeOnboarding` inserts the initial events.

**Withdrawal.** A new event. Future snapshots reflect it, and past snapshots are never
touched. Account deletion overrides all of this.

**UI.**

- `/welcome` (`welcome/page.tsx:79`): four separate toggles below the terms checkbox. All
  default off, and none is required to enter.
- `/settings`: a "Your data" panel with the toggles, version, date, and a link to history.
- Intake confirm step: the per-practice override.
- Re-consent gate: `OnboardingGate` (`src/app/providers.tsx`) compares
  `users.termsVersion`, `PRIVACY_VERSION`, and the latest consent version to the constants,
  and routes stale users to a re-accept screen.

**Migration.** Additive. Rows without a snapshot are excluded by rule. §7 adds an explicit
stamp for clarity.

**Conflict.** The re-consent gate interrupts existing testers once.

### 2. Retain raw inputs (Partial, S–M)

**What exists.** Material text survives (`materials.ts:69`). `scope` is immutable
(`practices.ts:187`).

**What's missing.** The spoken pitch, the "heard" extraction vs the confirmed scope, autofill
provenance, and consent per input.

**Schema.** `sources`:

```
{
  userId,
  practiceId?: Id<"practices">,
  kind: "spoken" | "deck" | "typed",
  materialId?: Id<"materials">,
  text?: blobRef,
  inferredKeys?: string[],
  capturedAt,
  consentVersion,
  aiCallId?: Id<"aiCalls">,
}
```

- Indexes: `by_practice`, `by_user`, `by_unattached ["practiceId","capturedAt"]`.
- `deck` rows **reference** the material; the text is not copied.
- `typed` rows record provenance only (`inferredKeys`). The text is `practice.scope`, which
  is immutable.
- "Pasted" maps to `typed`: the form cannot distinguish the two.

**Writes.**

- `extractScope` inserts a `spoken` source with `practiceId` unset and server-held text
  (the exact text the model saw), and returns `sourceId`.
- `practices.create` gains `sourceIds?: Id<"sources">[]` and `inferredKeys?`. It verifies
  each source is owned and unattached, patches `practiceId` onto it, and inserts the
  deck rows (one per material) and the typed row.
- An hourly cron (alongside `materials.sweepOrphans`) deletes unattached sources older than
  24h.

**Material versions.** Materials are add-only (`practices.ts:217-240`), so each row already
is a version. Add `textSha256` so re-uploads of identical text are detectable. The 80k
truncation stays as-is (open question).

**Migration.** None. Legacy practices simply have no sources.

### 3. Log every AI call raw (Missing, M)

**Schema.** `aiCalls`:

```
{
  userId, practiceId?, sessionId?,
  kind: usageKindValidator,
  provider: "openai" | "runway",
  model, promptVersion, promptHash,
  input: blobRef, rawOutput?: blobRef,
  parsedOk: boolean,
  dropped: { reason: string, item: string }[],
  error?: string,
  latencyMs, usageEventId?,
}
```

- `dropped` is capped at 20 entries, each item clipped to 300 chars.
- `error` is server-only text. Clients never read this table.
- Indexes: `by_user`, `by_practice`, `by_session`, `by_kind_version
  ["kind","promptVersion"]`.

**One source of truth.** Tokens and cost stay on `usageEvents`. `aiCalls` references them
through `usageEventId`, and `promptVersion` is added to `usageEvents` as requested. One
helper, `recordAiCall` in `convex/usage.ts`, replaces `recordUsage` at every call site and
writes both rows from a single input, so the two can never disagree.

**PROMPT_VERSION.** One constant per prompt module:

- `src/domains/<lane>/prompts.ts` (all prompts in the module share one version)
- `src/lib/signOff.ts`
- `src/lib/intake.ts`
- `src/lib/ending.ts`
- `src/domains/<lane>/briefing.ts`

The Runway personality version is the git hash of `docs/cast/personalities/<lane>.md`,
recorded by `push-personalities.ts`. That needs an `avatars.personalityVersion` field.

`promptHash` is the sha256 of the rendered messages. Enforcement: each `prompts.test.ts`
pins the hash of each prompt rendered against a fixture. Changing a prompt fails the test
until `PROMPT_VERSION` and the pinned hash are both bumped.

**Parsers report drops.** `parseDebrief`, `groundAudit`, `parseBlueprint`, the orchestrator
note filter, and the sign-off parse each return `dropped[]` alongside their result.
`debrief.ts:169-174` stops logging content.

**Runway.** `avatars.mint` writes an aiCall with the composed personality and startScript
as input and the Runway id as output. This is the record a future replay needs.

**Latency.** `Date.now()` taken around each provider call.

### 4. Append-only history (Missing, M)

**Schema.**

- `auditVersions`: `{ userId, practiceId, status, claims, gaps, closed, materialIds,
  materialSetHash, model, promptVersion, aiCallId }`. Index `by_practice`. Bounded at
  ≤15 claims and ≤10 gaps.
- `blueprintVersions`: the same shape plus refinement inputs.
- `continuitySnapshots`: `{ userId, practiceId, sessionId, continuity }`. Indexes
  `by_practice`, `by_session`.

**Writes.** In the same mutation as the "latest" patch:

- `setAuditOutcome` (`practices.ts:785`)
- `blueprints.setOutcome` (`blueprints.ts:68`)
- `recordContinuity` (`practices.ts:953`)

The practice fields stay as the latest view. User status changes to action items become
`events` (§10) rather than a fourth table.

**Session briefing provenance.** `insertSessionForPersona` stamps `briefedWith:
{ auditVersionId?, blueprintVersionId?, continuitySnapshotId? }`. Without this, a session
cannot be replayed against what it saw.

**Runway ids.** `sessions.runwaySessionIds: { id, at }[]`, bounded at 5 by
`MAX_CONNECTS_PER_SESSION` (`usage.ts:72`). Phases:

1. `setRunwaySessionId` appends and also sets the scalar.
2. Backfill the array from the scalar.
3. Readers (`avatars.ts:169`, `sessions.ts:323`, `api/avatar/session/route.ts:44`,
   `api/avatar/connect/route.ts:84`) read the last element. The DELETE route must accept
   any id in the list, not only the last.
4. Stop writing the scalar, unset it, and remove it from the schema.

**Gap ids.** A gap is identified as `auditVersionId:index`. Versions are immutable, so the
id is stable.

**Migration.** Seed version 1 from each practice's current audit or blueprint, flagged
`backfilled: true`.

### 5. Transcript and turn timing (Partial, L)

**Schema.** `turns`:

```
{
  userId, sessionId,
  seq,                      // server-assigned arrival ordinal
  type, text,
  spokenAt?, endedAt?,      // client-measured
  receivedAt,               // server
  interimCount?,
  wordCount,                // computed server-side at write
  latencyFromPrevTurnMs?, overlapMs?, bargeIn?,   // derived at finalize
  legacy?: true,
}
```

Indexes: `by_session_seq`, `by_user`. `speaker`, `speakerName`, and the client `timestamp`
are dropped; names are derived from `type` and `session.persona`.

**Capture changes.**

- **User turns.** `endedAt = anchor + words[last].end` (`founderTranscription.ts:93`).
  `interimCount` is counted per `turn_order`.
- **Avatar turns.** `spokenAt` becomes the `isSpeaking` rising edge and `endedAt` the
  falling edge. TranscriptBridge already commits on the falling edge
  (`TranscriptBridge.tsx:83-90`). Fall back to chunk arrival when there is no edge.
- **Derived fields.** An internal `finalizeTurns` mutation is scheduled at
  `endedAt + LATE_WRITE_GRACE_MS` (`sessions.ts:56`). It computes latency, overlap, and
  barge-in once, from one pure function in `src/lib/turnTiming.ts`, sorted by spoken time.
  It also writes a session rollup `timing: { userTurns, userSpokenMs, avatarSpokenMs,
  bargeIns, medianLatencyMs, fullTiming: boolean }` for the dashboard.

**The cap.** The 240-entry cap existed to protect document size (`sessions.ts:49-52`), and
it goes away. The plan still keeps a rate-based abuse ceiling, e.g. ≤2 writes/sec and
≤2,000 per session, because the boundary is a public mutation fed by the client. This
departs from the wording "remove the cap"; see Open questions.

**Migration** (dual-write, then backfill, then switch, then retire):

1. `addTranscriptEntry` writes both the array and the table.
2. A batched internal mutation copies embedded transcripts into `turns`, one session per
   step, with `legacy: true`, `receivedAt = timestamp`, and `seq` set to the array index.
3. Switch readers to `turns`: RoomShell and TranscriptPanel via a paginated query;
   TranscriptDialog; `orchestrator.ts:52`; `sessions.ts:285, 467, 625-657`;
   `avatars.ts:189`; `usage.ts:153`; `listByPractice` counts (`sessions.ts:183-185`), which
   need a `userTurnCount` rollup; the echo check (`sessions.ts:243`, `take(4)` desc).
4. Stop writing the array, make `transcript` optional, unset it, remove it.

### 6. Hidden internal judgment (Missing, S–M)

**Schema.** `assessments`:

```
{
  userId, practiceId, sessionId,
  readiness: "not_ready" | "borderline" | "ready" | "strong",
  confidence: number,                                    // 0–1
  itemSeverity: { ref: string, severity: 1|2|3|4 }[],    // capped at 20
  rationale,
  model, promptVersion, aiCallId,
}
```

`ref` points at debrief items (`sessionId:didntHold:i`) and audit gaps (`auditVersionId:i`).
Index `by_session`, `by_user`. No public query exists.

**Design choice.** A **separate** quality-tier call is scheduled after `setDebrief` wins
(`sessions.ts:730`). Adding fields to the debrief prompt would shift the visible output;
a separate call makes "must not change the user debrief" structural rather than a matter
of trust.

The readiness scale is pack-independent, so calibration works across lanes. The existing
`verdict` stays the user-facing categorical tier.

**Cost.** One extra quality call per debriefed session.

### 7. Real event capture at intake (Partial, S)

**What exists.**

- founder `stage` chips (`src/domains/founder/pack.ts:65`)
- interview `interviewType` and `seniority` (`interview/pack.ts:71, 76`)
- sales call type and goal (`sales/variant.ts`)

**What's missing.** No event date anywhere. Counterpart is free text in places (sales
`prospect`, `variant.ts:60, 95`), which can hold a real name.

**Schema.** Optional `event: { date?: string (ISO date), counterpartCategory?: string,
stage?: string }` on practices.

- The vocabularies live in each pack (`pack.eventFields`), not in the schema.
- `practices.create` validates against the pack, the same way scope chips are validated
  (`practices.ts:141-163`).
- To avoid duplication, where a lane already asks (founder `stage`, interview
  `interviewType`), `event.stage` is **derived** from the scope rather than asked twice.

Proposed categories (all open to your edit):

| Lane | Counterpart categories | Stage |
|---|---|---|
| Founder | VC firm, angel, accelerator, corporate VC, other | already in scope |
| Sales | enterprise buyer, mid-market, SMB owner, procurement, partner | first call, discovery, demo, negotiation |
| Interview | hiring manager, recruiter, panel, executive | already in scope |
| Audit | external auditor, regulator, certification body, internal audit | first audit, surveillance, recertification |

**UI.** Two optional fields in TypedForm and ConfirmBrief. The date is a native date input.

**Migration.** None.

### 8. Outcome loop (Missing, M–L)

**Schema.** `outcomes`:

```
{
  userId, practiceId, lane,
  ask: string,              // e.g. "d2", "d30"
  dueAt,
  status: "scheduled" | "asked" | "answered" | "skipped",
  askedAt?, answeredAt?,
  channel?: "in_app" | "email",
  value?: string,           // pack vocabulary
  amount?: number, findingsCount?: number, note?: string,   // note ≤500
  mattered?: string[],      // refs, ≤10
}
```

Indexes: `by_practice`, `by_user`, `by_status_due ["status","dueAt"]`.

**Schedule.** Rows are created at `practices.create`, and re-anchored when an event date is
set. The schedule and answer vocabulary live in each pack (your table). A daily cron reads
`status="scheduled" AND dueAt ≤ now` through the index, `take(100)`, paginated. It checks
the **current** `outcomeFollowups` consent at send time, so a withdrawal stops future asks.
Without consent the row is marked `skipped`.

**Channel.** Recommend **both**:

- In-app: a card on Home and the practice page, the next time the user visits.
- Email via Resend, only for the 30/90/180-day asks, where the user may not return.

Email needs a one-tap answer link carrying a signed, single-use, expiring token, checked
server-side (an HMAC secret in the Convex env). Resend becomes a new disclosed processor and
receives the Clerk email address.

**Reward.** A `rewardEligible` flag on answered rows now; turn it into a session credit
when billing exists.

**Auth.** `outcomes.answer` validates ownership and the value against the pack vocabulary.
The email route validates the token and never trusts a userId in the URL.

### 9. Feedback signal (Missing, M)

**Schema.** `feedback`:

```
{
  userId, practiceId, sessionId?,
  targetType: "turn" | "claim" | "gap" | "debriefItem" | "verdict" | "session",
  targetId,
  rating: -1 | 1,
  tag?: "real_gap" | "not_a_gap" | "fair_question" | "unfair_question" | "agree" | "disagree" | "dispute",
  note?,                    // ≤500
  promptVersion,            // server-derived snapshot of the rated output's version
}
```

Append-only; the latest row per target is the current answer. Indexes:
`by_target ["targetType","targetId"]`, `by_practice`, `by_user`.

**Auth.** `feedback.give` parses `targetId`, loads the doc, applies `ownedOrNull`, and
range-checks the index. Rate is limited per user.

**Target ids** (stable because their parents are immutable):

- `auditVersionId:i`
- `sessionId:heldUp:i`, `sessionId:didntHold:i`, `sessionId:verifyItems:i`
- `turnId`

**UI.** One tap, optional, never blocking:

- `GapCard` (`AuditStage.tsx:34`) and the practice gap list
  (`p/[practiceId]/page.tsx:306`): "real gap?" and "fair question?"
- Debrief items (`s/[sessionId]/page.tsx:342, 370, 397`): agree or disagree.
- The verdict block: a dispute control with an optional note.

**Conflict.** Today the gap list re-renders the latest audit. Feedback given on an old
version stays attached to that version.

### 10. Product events (Missing, S–M)

**Recommendation.** Own `events` table rather than a hosted tool.

| | Own table | Hosted tool (e.g. PostHog) |
|---|---|---|
| Consent and deletion | Same consent and deletion cascade | Separate deletion API and processor disclosure |
| Data asset | Joins with sessions and outcomes; part of the transferable asset | Lives outside the asset |
| Confidentiality | Nothing new | Session replay would capture confidential decks |
| Tooling | Funnels have to be built (the dashboard) | Free funnels and cohorts |

**Schema.** `events`: `{ userId, name, props: v.record(v.string(), v.union(v.string(),
v.number(), v.boolean())), at }`. Indexes: `by_user`, `by_name ["name","at"]`.

**Writes.** Emitted server-side inside the mutation that does the thing. A small public
`events.track` mutation covers client-only moments, with a name allowlist and a props
validator.

| Event | Site |
|---|---|
| signup | `users.completeOnboarding` |
| intake_started | `track`, on `/simulation/new` mount |
| intake_completed | `practices.create` |
| session_started {nth} | `insertSessionForPersona`; first and second session are derived from `nth` |
| session_ended {endedReason} | `sessions.end` |
| session_abandoned | new cron that concludes stale live sessions |
| debrief_viewed | `track` |
| material_added | `attachMaterials` |
| action_item_status | `setActionItemStatus` |
| upgrade, churn | later, with billing |

**Conflict.** Abandonment today is derived at read time, and a silent room never goes stale
(`src/lib/session.ts:1-6`). Recording `abandoned` requires adding `"abandoned"` to
`endedReasonValidator` (widening, additive) plus a cron.

### 11. Deletion that matches the promise (Partial, M)

**Design.**

- Add `users.deletionRequestedAt`. `deleteAccount` stamps it, which makes queries read the
  user as absent immediately, and schedules `deletion.step`.
- `deletion.step` is an internal mutation that walks a registry
  `DELETABLE_TABLES = [turns, aiCalls, sources, auditVersions, blueprintVersions,
  continuitySnapshots, assessments, feedback, outcomes, events, consentEvents, usageEvents,
  materials, sessions, practices]`.
  - It deletes ≤200 docs per step via each table's `by_user` index, releases referenced
    blobs, and re-schedules itself until empty.
  - It then deletes the users row.
- `practices.remove` uses the same registry through `by_practice`.
- A test asserts that every table in the schema with a `userId` field is in the registry,
  so a future table cannot be forgotten.
- Also: release live Runway sessions; stop logging content to Convex; send a best-effort
  Runway DELETE for every id in `runwaySessionIds`.

**Aggregates.** Keep only `monthlySnapshots` (§13). They contain no userIds, no practiceIds,
and no text, and they survive deletion. Snapshot cost totals *before* deleting
usageEvents so historical cost reports stay correct.

**Consent history on deletion** is an open question: keeping a hashed-id consent proof may
be legally useful.

**Draft privacy wording (DRAFT FOR COUNSEL):**

> When you delete your account, we delete every practice, upload, spoken or typed input,
> transcript, debrief, rating, outcome answer, and record of your activity from our
> database and file storage within [7] days. Uploads you started but never submitted are
> removed within 24 hours. We keep only monthly totals that cannot identify you (for
> example, "412 sessions in March"). Copies held by our processors are deleted under their
> retention terms, described below.

### 12. De-identification (design only)

**Design.** De-identification happens at export, never at capture. A future internal action
builds an export from `trainingEligible` sessions only:

1. Structural drops: `practice.name`, the pack `subjectField`, free-text counterpart fields
   (sales `prospect`), emails, and URLs. userId becomes a per-export salted hash, with the
   salt rotated per licensee so datasets cannot be linked.
2. Text redaction across scope, materials, turns, and debrief quotes. Person, org, email,
   phone, money, and specific dates become typed placeholders: deterministic regex first,
   then a model pass. The pass is recorded as an aiCall.
3. Numeric bucketing for amounts (outcome amounts become ranges).
4. A k-anonymity check over lane, industry, stage, and counterpartCategory. Rare
   combinations are suppressed.
5. Human review of a sample before any transfer.

**Kept:** lane, persona snapshot, consent version, assessment, feedback, outcomes, and turn
timing.

**Source and consent per material.** The `sources` row that references each material
already carries both. No duplicate field is added to `materials`.

### 13. Data-asset dashboard (Missing, L)

**Route.** `src/app/(app)/admin/page.tsx`. The middleware is defense in depth only; the
real gate is `requireAdmin` on every `admin.*` Convex function.

**Snapshot job.** A monthly cron (`crons.monthly`) runs `admin.computeMonth`, an internal
action. It pages through the month's sessions, practices, feedback, outcomes, assessments,
events, and usageEvents using `by_creation_time` **range** queries, with pagination as in
`usage.ts:120-159`. It then inserts a `monthlySnapshots` row: `{ month: "2026-11",
metrics, computedAt, codeVersion }`, unique by month and insert-only.

Range reads are indexed and bounded by one month's volume; no whole-table scan. If volume
outgrows a monthly page-through, switch to `@convex-dev/aggregate` counters.

**Metrics** (all from the tables above):

- Graded episodes: debrief present, `timing.userTurns ≥ 10`, and ≥1 feedback row on the
  session.
- Training-consent coverage, with audio reported separately.
- Outcome linkage by lane: `outcomes.by_status_due` against practices past their event date.
- Calibration: assessment readiness vs outcome value, plus dispute rate.
- Longitudinal depth: sessions per practice, and the share revised between sessions (a
  `material_added` event between two sessions).
- Coverage by lane, persona, stage, and industry.
- Spoken hours with `timing.fullTiming`, plus consented-audio hours (0 until audio exists).
- Exclusivity: the `assetFlags` table `{ key, value, note, setAt }`, written by CLI only.
- Retention and time to second session, from `session_started`.
- Feedback rating by `promptVersion`.
- AI cost per session, from usageEvents.

**UI.** The current month computed live, past months read from snapshots. Load the
`dataviz` skill at build time.

### 14. Beta data handling

**Recommendation: do both, in this order.**

1. **Mark all pre-consent records as permanently excluded.** A backfill stamps `consent:
   { version: "pre-consent", training: false, ... }` on every existing practice and
   session, so dashboards count them explicitly. The rule "no snapshot means excluded"
   already holds without it.
2. **Re-consent prompt for existing testers.** This is needed anyway because the terms
   change. Their new choices apply **only to practices and sessions created afterward**.

Do **not** offer retroactive inclusion in Tier 0. With 2 debriefed prod sessions, the
upside is negligible and the FTC risk is real. If you want it later, it should be a
separate, explicit, unchecked opt-in that counsel has reviewed.

### 15. Housekeeping

- Remove `closeDeliveredAt`: first unset it on the one dev doc with an internal mutation,
  then drop it from the schema.
- Remove `transcript.speaker` and `speakerName` with the §5 migration.
- Remove `materials.size`, or read it for the coverage metrics. Open question; this plan
  leans toward removing it.
- Keep `connectMs` and `micCheck`; give them their first reader in the dashboard.
- Add `usageEvents.by_user` and cascade usageEvents in both deletes.
- Fix Privacy copy: "ideas" becomes "practices"; add Vercel; add the content-logging note,
  or stop logging content (recommended).
- Implement the re-accept gate that the `schema.ts:123` comment promises.
- Update CLAUDE.md's stale table names.
- Delete the five empty legacy tables on dev from the dashboard.

---

## 4. Disclosure gap list

Everything in this section is **DRAFT FOR COUNSEL** and is not final legal language.

**Retroactive-change warning.** Items marked ⚠ change the terms for existing users. FTC
staff guidance (Feb 2024) warns that quietly changing terms or privacy policies to permit
AI training on data already collected can be unfair or deceptive.

**Versioning recommendation.**

- Split the version into `TERMS_VERSION`, `PRIVACY_VERSION`, and `CONSENT_VERSION`.
- On a material change, block entry until the user affirmatively re-accepts. "Continued
  use" alone is not acceptance (`terms/page.tsx:98`).
- Never treat data from before the change as covered by it.
- Keep every published version of each document in git and serve archived versions at
  `/terms/<version>`.

| # | Topic | Current | Needed |
|---|---|---|---|
| D1 ⚠ | Training consent, separate from the operating license | "the limited license needed to operate the service" (`terms:37-39`); "Solely to run the service" (`privacy:38`) | A separate opt-in license, distinct from operation |
| D2 ⚠ | Licensing and assignment to a successor | "we may assign them in connection with a merger, acquisition, or sale of assets" (`terms:114-115`) | Data and consents travel with the business, bound by the same promises |
| D3 | De-identification | absent | What "de-identified" means |
| D4 | Outcome follow-up contact | absent | Contact permission and opt-out |
| D5 | Audio and voice (draft only; audio is not being built) | "your audio … is streamed … our avatar provider may create a recording" (`privacy:29-30`); `PanelSetup.tsx:124-125` | Separate biometric-grade opt-in |
| D6 | Processor list | Clerk, Convex, OpenAI, Runway, AssemblyAI (`privacy:46-52`) | Add Vercel; Resend (if §8); purposes |
| D7 | Retention periods | "until you delete it" (`privacy:69`) | Concrete periods |
| D8 | Complete deletion | "permanently removes your ideas, uploads…" (`privacy:70-71`) | Wording from §11 |
| D9 | Plain "what we collect and who can see it" | absent | In-product explainer |
| D10 | Intake voice notice | absent (`TellIt.tsx`) | Notice before recording |

**D1 (DRAFT FOR COUNSEL).**

> **Improving Prestage (optional).** If you turn on "Help improve Prestage," you also grant
> us a non-exclusive, worldwide, royalty-free, perpetual license to use de-identified copies
> of your session text (your brief, uploaded documents' text, transcripts, debriefs, your
> ratings, and outcome answers) to develop, train, evaluate, and improve Prestage's models
> and evaluations, and to license or transfer that de-identified data to partners and to
> any successor. This license applies only to content created while the setting is on.
> Turning it off stops future use; it does not recall de-identified data already
> incorporated into a model or dataset. Prestage works fully with this setting off.

**D2 (DRAFT FOR COUNSEL).**

> If Mayday Media LLC is involved in a merger, acquisition, financing, reorganization, or
> sale of all or part of its assets, your account data and the permissions you have given
> us, including any "Help improve Prestage" license, may transfer to the successor. The
> successor must honor this policy and your choices for data collected under it. We will
> notify you before your data becomes subject to a different policy.

**D3 (DRAFT FOR COUNSEL).**

> "De-identified" means we remove or replace names, company names, email addresses, phone
> numbers, web addresses, and specific financial figures, replace your account identifier
> with a random code, and suppress rare combinations of details that could single you out.
> We prohibit recipients from attempting to re-identify anyone.

**D4 (DRAFT FOR COUNSEL).**

> **Follow-ups (optional).** If you allow it, we may ask, in the app or by email, how your
> real interview, pitch, sales meeting, or audit went, at set intervals (for example, 2 and
> 30 days after the date you gave us). Answering is always optional. You can turn this off
> in Settings or from any follow-up email.

**D5 (DRAFT FOR COUNSEL; audio is not being built).**

> **Audio retention (optional, off by default).** Without this setting, we do not keep
> recordings of your voice; audio is streamed only to transcribe and run the session. If
> you turn it on, we keep recordings of your voice from sessions for [purpose] for up to
> [period]. Recordings may be considered biometric information under laws such as the
> Illinois Biometric Information Privacy Act. We will not create voiceprints or use your
> voice to identify you, will not sell recordings, and will delete them [within period] or
> when you turn this off or delete your account. Your written consent is required before
> any recording is kept.

Counsel should confirm separate written-release requirements (BIPA, Texas CUBI,
Washington).

**D6 (DRAFT FOR COUNSEL).** Processors and what each receives:

> - **Vercel**: hosts the website and server routes (request data, logs)
> - **Clerk**: sign-in (name, email)
> - **Convex**: database, file storage, server logs (all content)
> - **OpenAI**: analysis of briefs, materials, transcripts
> - **Runway**: live avatar (audio and video streams, session briefing, possible session
>   records)
> - **AssemblyAI**: speech-to-text (microphone audio)
> - **Resend**: follow-up email (email address, if follow-ups are on)

**D7 (DRAFT FOR COUNSEL).**

> We keep your content until you delete it or your account. Accounts inactive for [24
> months] are deleted after [30] days' notice. Uploaded files are deleted once their text
> is read (usually within minutes); files never submitted are deleted within 24 hours.
> Server logs are kept for [N] days.

**D9 (DRAFT FOR COUNSEL).** In-product explainer for the Settings page and the intake
footer:

> **What we collect, and who can see it.**
>
> - **You** see everything in your account.
> - **Nobody else using Prestage** can see any of it.
> - **Our team** can access it only to fix a problem you report or to keep the service
>   safe, and access is logged.
> - **Our AI providers** process it to run your session and may keep it briefly under
>   their terms; they are not permitted to train on it [confirm per vendor].
> - **Your materials and sessions are never used to improve Prestage unless you turn on
>   "Help improve Prestage,"** and even then only de-identified copies.
> - **Audit-lane practices are excluded by default.**
> - **Delete anything, anytime.** Deleting is permanent.

The bracketed claims depend on the vendor answers in §5 and on whether staff access is
actually logged (it is not today). Do not ship them until both are true.

**D10 (DRAFT FOR COUNSEL).**

> Your voice is streamed to our speech-to-text provider to transcribe this pitch. We keep
> the text, not the audio.

**Other items for counsel:**

- Whether licensing de-identified data to partners is a "sale" or "sharing" under CCPA or
  CPRA, which would require an opt-out mechanism.
- GDPR lawful basis if any EU users are admitted.
- Whether the audit-lane confidentiality default should be a contractual prohibition
  rather than a default.

---

## 5. Vendor questions

**Runway**

1. Does a GWM-1 realtime session produce a stored video or audio recording, a transcript,
   or a "conversation record"? Where does it live, and is it reachable by realtime session
   id via the API?
2. Who owns those recordings and records? Does Runway claim any license to them, or to the
   personality and startScript we send?
3. Does Runway train or improve models on session audio, video, transcripts, or the
   briefing text? Is there an opt-out or an enterprise no-train term?
4. What is the retention window? Does `DELETE /v1/realtime_sessions/{id}` delete the stored
   record, or only end the session? Can we request deletion per user?
5. Can recordings be exported in bulk, and in what format (separate user and avatar audio
   tracks, with timestamps)?
6. Can we get per-utterance timing (avatar audio onset and offset) from the data channel or
   the post-session record?
7. Sub-processors, data location, and whether a DPA is available.

**AssemblyAI (Universal-Streaming v3)**

1. Is streamed audio or its transcript stored after the session? For how long?
2. Is customer data used for model training by default? How do we opt out at the account
   level, and is there a per-request parameter?
3. Is a zero-retention or no-train option available on our plan, and is a DPA available?
4. Are word-level `end` timings reliable enough for per-turn end time and overlap
   measurement?
5. Data location and sub-processors.

**OpenAI**

1. Confirm that API data (Chat Completions, no `store` parameter set) is not used for
   training, and the abuse-monitoring retention window.
2. Is Zero Data Retention available for our org? What does it require?
3. With `store` unset on Chat Completions, is anything retained beyond abuse monitoring?
4. DPA and data residency options.
5. Whether our planned de-identification model pass falls under the same terms.

**Convex, Vercel, Clerk** (lighter)

1. Log retention windows. Can logs be purged per user?
2. Backup retention, and whether deleted documents persist in backups and for how long.
3. DPAs.

---

## 6. Implementation sequence

Each step ships independently, and each step that adds a table registers it in the
deletion cascade (0.1) in the same change.

### Tier 0: before public launch

| Step | Contents | Items | Size | Depends on |
|---|---|---|---|---|
| 0.1 | Deletion framework: `by_user` on usageEvents, batched cascade, registry and coverage test, Runway release; stop content logging; remove `closeDeliveredAt` | 11, 15 | M | — |
| 0.2 | PROMPT_VERSION constants, hash-pinned tests, `aiCalls` plus `recordAiCall`, parsers return `dropped[]`, Runway briefing logged | 3 | M | 0.1 |
| 0.3 | Consent ledger, snapshots, `orgPolicies`, lane exclusion, welcome/settings/intake UI, split versions, re-accept gate, pre-consent backfill. **Gated on counsel-approved copy (D1–D10)** | 1, 14 | M–L | 0.1 |
| 0.4 | `sources` (spoken pitch retained, provenance), orphan sweep | 2 | S–M | 0.2, 0.3 |
| 0.5 | `auditVersions`, `blueprintVersions`, `continuitySnapshots`, `briefedWith`, `runwaySessionIds` phases 1–2 | 4 | M | 0.2 |
| 0.6 | `turns` table: dual-write, capture timing, backfill, reader switch, finalize, retire array; cap becomes a rate limit | 5 | L | 0.1 |
| 0.7 | `assessments` (separate hidden call) | 6 | S–M | 0.2, 0.5 |
| 0.8 | `event` fields at intake | 7 | S | — |
| 0.9 | `feedback` table and one-tap UI | 9 | M | 0.5, 0.6 |
| 0.10 | `events` table, emit sites, abandoned-session cron | 10 | S–M | 0.1 |
| 0.11 | Privacy and Terms republish (counsel copy), processor list, explainer | 11, 15 | S | 0.3 |

### Tier 1: first 90 days

| Step | Contents | Items | Size |
|---|---|---|---|
| 1.1 | `outcomes`, cron, in-app card | 8 | M |
| 1.2 | Resend email and signed answer links | 8 | M |
| 1.3 | `requireAdmin`, `/admin`, monthly snapshot job, `assetFlags` | 13 | L |

### Tier 2: deferred (design so nothing blocks)

- **Audio.** The `audioRetention` consent field exists from 0.3. A future
  `sessionAudio { sessionId, userId, track, storageId, durationMs }` table is pre-named in
  the deletion registry design. Nothing is built now.
- **Replay and environment API.** Needs persona snapshot (exists), `briefedWith` (0.5), the
  Runway briefing in aiCalls (0.2), material text plus sources (0.4), turns with timing
  (0.6), and feedback plus outcomes. A replay runs a different model against stored inputs
  and scores against feedback and outcomes.
- **De-identified export.** §12.
- **Panelist A/B.** Add `sessions.variantKey` at insert. `promptVersion` on aiCalls
  already separates arms.

---

## 7. Migration and backfill plan

All changes are additive. Each backfill is an `internalMutation` that processes ≤100 docs
per call and re-schedules itself with a cursor, so no single transaction is unbounded. Each
is run by CLI (`npx convex run …`) on dev, verified, then run on prod. Prod volume is tiny,
so each finishes in one or two batches.

| Step | Backfill | Verification |
|---|---|---|
| 0.1 | Unset `closeDeliveredAt` (1 dev doc), then drop the field. Existing orphan usageEvents on dev (155) are deleted by a one-off sweep of rows whose practice or session is gone | `npx convex data` count of orphans is 0; schema deploys clean |
| 0.3 | Stamp `consent: PRE_CONSENT` on all practices and sessions. **No consentEvents are fabricated**: existing users get none, so the re-consent gate catches them | every practice and session has `consent.version` |
| 0.5 | Seed `auditVersions` and `blueprintVersions` from the current fields (`backfilled: true`); copy `runwaySessionId` into `runwaySessionIds` | counts match practices with audit or blueprint; sessions with the scalar have the array |
| 0.6 | Copy embedded transcripts to `turns` (`legacy: true`, `seq` = index, `receivedAt` = timestamp). Then switch readers, then clear the arrays | per-session turn count equals array length before clearing; spot-check order by `bySpokenTime` |
| 0.10 | Optional: synthesize `signup` and `session_started` events from `users._creationTime` and `sessions._creationTime`, flagged `backfilled` | |
| Timing | Legacy turns get no `endedAt`, so `timing.fullTiming = false` and they are excluded from spoken-hours-with-timing | |

---

## 8. Open questions for you

1. **Counsel.** Who reviews D1–D10, and is a pre-launch review realistic? Step 0.3 is
   gated on it.
2. **Abuse ceiling.** Do you accept a rate-based ceiling (e.g. 2,000 turns per session) in
   place of the 240 cap, given the never-trust-the-client rule? Or do you want no ceiling
   at all?
3. **Audit lane.** Excluded by default with a per-practice opt-in (recommended), or treated
   like the other lanes?
4. **Outcome email.** Is adding Resend as a processor acceptable, and which sending domain?
   Or should outcomes start in-app only?
5. **Admin identity.** Gate on your Clerk user id in the `ADMIN_CLERK_ID` env (recommended),
   or on a Clerk role?
6. **Material truncation.** Keep the 80k-char clamp (`src/lib/materials.ts:8`), or retain
   the full text in storage for the asset while still clamping prompts?
7. **Consent history after deletion.** Delete it with the account, or keep a hashed-id
   proof of consent? This is a counsel question too.
8. **Inactive-account retention period** for D7.
9. **Research program.** What does "fuller consent" cover beyond training (for example,
   human review of raw transcripts, or interviews)? And what is the free-session reward
   until billing exists?
10. **Industry coverage.** Only interview asks for industry (`industryContext`). Add an
    optional industry chip to the other lanes in step 0.8?
11. **Legacy transcript readers.** Is it acceptable that pre-migration sessions show no
    timing in the dashboard?
12. **usageEvents vs aiCalls.** Long term, fold the OpenAI rows of usageEvents into aiCalls,
    leaving one per-call table? This plan keeps both, linked, to avoid touching the meter
    in Tier 0.

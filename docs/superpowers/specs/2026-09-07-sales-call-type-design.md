# Sales lane: call type (cold call vs pitch meeting)

## Problem

Beta feedback: the sales run "felt like an interview, not a cold-outreach
call." Root causes, verified in code:

- The ending contract is lane-blind. Every session tells the panelist to run
  a probing middle and land a closing read, so the buyer interrogates.
- The buyer pre-reads the seller's materials and audit gaps. A cold-call
  prospect knows nothing about the caller.
- The stored Runway personality carried a fixed employer and backstory that
  overrode the session's "you are playing" line. (Fixed on the Runway side:
  Cole is now identity-light and reads role, company, and industry from the
  session context.)

## Decision

One sales lane, two call types. The lane opens with "What kind of call is
this?" The answer picks the buyer and the shape of the practice:

| | Cold call | Pitch meeting |
|---|---|---|
| Intake fields | callType, prospect, offering, goal | callType + today's fields |
| Tell-it beat, uploads | no | yes |
| Read + audit stages | no | yes |
| Panel | Greg Hollis (`prospect-01`), locked | Cole Merritt (`buyer-01`), locked |
| Room budget | 2 minutes | 5 minutes |
| Closing read | no | yes |
| Verdicts | booked / follow-up / brushed-off | buy / second-meeting / walk |

No gate between them. Progression is a debrief suggestion: a booked cold
call offers "Prep the meeting with Cole" with offering and prospect carried
over.

Deferred: Greg hanging up and the room ending on it. Greg signals the call is
over and goes cold; the room ends on its clock. Revisit with the ending
detector.

## Design

### Pack contract (`src/domains/types.ts`)

Two optional additions to `DomainPack`:

```ts
variantField?: string                 // key of a chips scope field
variant?: (scope: Scope) => PracticeVariant
nextStep?: (scope: Scope, verdict: string) => { label: string; scope: Scope } | null
```

```ts
type PracticeVariant = {
  scopeFields: ScopeField[]
  prep: boolean
  personaId: string | null
  roomMinutes: number
  closingRead: boolean
  verdicts: VerdictVocabulary       // { options, fallback }
  panelLead: string
}
```

`variantOf(pack, scope)` in `src/domains/registry.ts` returns
`pack.variant?.(scope)` or the default: all scope fields, prep true, no lock,
5 minutes, closing read on, `pack.verdicts`, `pack.copy.panel.lead`. The
founder, audit, and interview packs never change behavior.

`pack.verdicts` remains the union of every value the pack can produce, used
for badge labels, tone rank, and the cross-pack distinctness test. Each
variant's `verdicts` is the subset the debrief may pick.

### Sales rulebook (`src/domains/sales/variant.ts`)

- `callType` chips field, required, options "Cold call" / "Pitch meeting".
  Stored value is the label, per the existing chips convention.
- No call type yet: `scopeFields = [callType]`, other values as pitch.
- Cold call: fields callType, prospect ("Who are you calling?", text 80),
  offering ("What do you sell?", text 60), goal (chips: "Book a meeting",
  "Permission to follow up", "A yes on the spot"). prep false, persona
  `prospect-01`, 2 minutes, closingRead false, verdicts
  booked (good) / follow-up (mid) / brushed-off (bad), fallback follow-up.
- Pitch meeting: callType + existing fields. prep true, persona `buyer-01`,
  5 minutes, closingRead true, existing verdicts.
- `nextStep`: cold call with verdict `booked` returns
  `{ label: "Prep the meeting with Cole", scope: { callType: "Pitch meeting", offering, prospect } }`,
  else null.

### Intake (`src/app/(flow)/simulation/new/page.tsx`)

New beat `choose`, the initial beat when the pack has a `variantField` and
the scope lacks it. Renders that one field as large chips via the existing
`ScopeFields` renderer. Picking a value seeds the scope and advances: to
`tell` when the variant has prep, to `type` otherwise.

Everything that reads `pack.scopeFields` reads `variantOf(pack, scope).scopeFields`:
`TypedForm`, `ConfirmBrief`, `missingRequired`, `extractScope` inputs, and
server-side `practices.create` validation. Form sections filter to active
keys; a section with no active keys is not rendered. The materials block is
rendered only when the variant has prep.

`?from=` prefill keeps the source call type and skips the choose beat. With
`&next=1`, the intake seeds from `pack.nextStep(source.scope, source.lastVerdict).scope`
instead of the source scope; if `nextStep` returns null it falls back to the
source scope.

### Stages

- `practices.create`: with prep false, insert with status `ready`, reject
  materials, schedule nothing. Otherwise unchanged.
- Intake routes to `/panel` when prep is false, else `/analyze`.
- `analyze` and `audit` pages redirect to `/panel` when the practice's
  variant has prep false.
- `FlowShell`: `flowSteps(pack, scope)` pure helper in `src/lib/flowSteps.ts`
  returns the rail; it omits the pre-read step when prep is false.

### Panel (`PanelSetup.tsx`)

The single-persona branch takes the persona to render. It renders when the
variant locks a persona or the pack has one persona. The receipt chips omit
the gap map when the practice has no audit. The lead comes from
`variant.panelLead`.

### Room

- `sessions.insertSessionForPersona` stamps `roomMs` on the session from
  `variantOf(pack, practice.scope).roomMinutes`. Schema: `roomMs: v.optional(v.number())`;
  readers fall back to `ROOM_MS` for sessions created before this field.
- `usage.claimConnect`, `sessions` time-end check, and `RoomShell` pass the
  session's budget to the existing roomClock helpers.
- `avatars.mint`: when `closingRead` is true, append `endingContract(first, minutes)`
  and `withTimeContract(startScript, minutes)`; when false, append neither.
  `withTimeContract` takes minutes and words them ("two", "five").
- `orchestrator.decide` skips the close check when `closingRead` is false.
- Sales `briefing`: cold call preamble casts the avatar as `prospect` only,
  states the call is unexpected and the caller unknown, carries no materials,
  gaps, or ask, and includes the no-hang-up rules. Start script: a one-line
  phone answer. Pitch meeting briefing unchanged.
- Sales `orchestrate` prompt: cold-call version drops the objection catalog
  probes and notes opener, brush-off handling, and the ask.

### Debrief

- Sales `debrief` prompt branches on call type. Cold call lens: did the
  opener earn thirty seconds, how were brush-offs handled, was there one
  specific ask, and what happened against the chosen goal. It lists only the
  variant's verdict values.
- `sessions.generateDebrief` passes `variantOf(pack, practice.scope).verdicts`
  to `parseDebrief` (values, fallback, lowest).
- Session debrief page: when `pack.nextStep` returns a suggestion for this
  practice's scope and verdict, render it beside "Go again" as a link to
  `/simulation/new?from={practiceId}&next=1`.

### Not changed

Ending detector, mic check, materials re-run, persona grid copy for packs
with two or more unlocked personas (no pack has that after this change).

## Tests (node --test, pure functions)

- `src/domains/sales/variant.test.ts`: fields per call type and pre-choice;
  prep, lock, minutes, closingRead, verdicts per type; nextStep mapping and
  null cases.
- `src/domains/registry.test.ts`: `variantOf` default for packs without a
  variant; verdict values distinct across packs still holds with the union.
- `src/domains/sales/briefing.test.ts`: cold preamble names the prospect,
  omits materials, gaps, ask; start script has no time promise.
- `src/domains/sales/prompts.test.ts`: cold debrief lists only cold verdicts
  and the goal; cold orchestrate omits objection probes.
- `src/lib/ending.test.ts`: `withTimeContract` words the minutes.
- `src/lib/flowSteps.test.ts`: three steps without prep, four with.
- `src/lib/debrief.test.ts`: participation floor uses the given lowest value
  (existing test covers the parser contract).

# Sales Call Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The sales lane opens with "What kind of call is this?" and a cold call runs a short, no-prep, two-minute room with Greg Hollis while a pitch meeting keeps today's flow with Cole Merritt.

**Architecture:** A pack may declare a `variantField` and a `variant(scope)` resolver returning a `PracticeVariant` (fields, prep, locked persona, room minutes, closing read, verdicts, copy). The engine consults `variantOf(pack, scope)` everywhere a lane can differ per practice, with a default that reproduces today's behavior for packs without a variant. The sales pack is the only implementer.

**Tech Stack:** Next.js 16 (app router, client components), Convex (schema, mutations, actions), TypeScript strict, Tailwind v4 utilities, `node --test` for pure-function tests.

**Spec:** `docs/superpowers/specs/2026-09-07-sales-call-type-design.md`

## Global Constraints

- No semicolons. Const arrow functions only. `Handle` prefix on event handlers. Early returns over nesting.
- Tailwind utility classes only. No `tailwind.config.ts`.
- Every public Convex function keeps its `requireIdentity` / `ownedOrNull` check. No new public function without one.
- No TODOs or placeholders. No `useState` for data that belongs in Convex.
- **Never commit.** The developer commits after reviewing the diff. Every "commit" moment in this plan means: stop, leave the work in the tree, run the verification listed.
- No em dashes in any copy, prompt, or comment.
- Chips store the option **label**, not the value.
- Tests: `pnpm test` (node --test). Typecheck: `npx tsc --noEmit -p .`. Lint: `pnpm lint`. Convex push to dev: `npx convex dev --once`.
- Runway personality text is not in this repo. Greg and Cole are already registered on dev (`sales/prospect-01`, `sales/buyer-01`).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/domains/types.ts` (modify) | `PracticeVariant`, `VerdictVocabulary`, `ScopeFieldOption.hint`, `variantField` / `variant` / `nextStep` on `DomainPack`. |
| `src/domains/registry.ts` (modify) | `variantOf(pack, scope)` with the default, `lockedPersona(pack, variant)`. |
| `src/domains/sales/variant.ts` (create) | The sales rulebook: call-type field, per-type fields, verdict sets, copy, `salesVariant`, `salesNextStep`. |
| `src/domains/sales/pack.ts` (modify) | Wires the rulebook. `verdicts` becomes the union. `sessionMetaField` = call type. |
| `src/domains/sales/personas.ts` (modify) | Cole's card matches his identity-light personality. |
| `src/domains/sales/briefing.ts` (modify) | Cold-call briefing branch. |
| `src/domains/sales/prompts.ts` (modify) | Cold-call orchestrate and debrief branches. |
| `src/lib/ending.ts` (modify) | `withTimeContract(startScript, minutes)`, `minutesPhrase(minutes)`. |
| `src/lib/flowSteps.ts` (create) | `FlowStage`, `flowSteps(pack, scope)`: the rail, minus pre-read when the variant has no prep. |
| `src/components/simulation/flow/FlowShell.tsx` (modify) | Uses `flowSteps`; accepts `scope`. |
| `src/components/simulation/intake/VariantChooser.tsx` (create) | The "choose" beat: one chips field as large cards. |
| `src/app/(flow)/simulation/new/page.tsx` (modify) | Choose beat, variant-aware routing and submit, `?next=1` seeding. |
| `src/components/simulation/intake/TypedForm.tsx` (modify) | Reads the variant for fields, sections, materials, preview rail, CTA. |
| `src/components/simulation/intake/ConfirmBrief.tsx` (modify) | Reads the variant for fields and CTA. |
| `src/components/simulation/intake/AnalysisPipeline.tsx` (modify) | Redirects a no-prep practice to the panel. |
| `src/app/(flow)/simulation/[id]/audit/page.tsx` (modify) | Same redirect. |
| `src/components/simulation/intake/PanelSetup.tsx` (modify) | Locked persona card, no context gate without prep, variant lead. |
| `convex/schema.ts` (modify) | `sessions.roomMs`. |
| `convex/practices.ts` (modify) | `create` validates against the variant, no-prep practices are ready at insert. |
| `convex/sessions.ts` (modify) | `insertSessionForPersona` takes the practice and stamps `roomMs`; time check and debrief verdicts read the variant. |
| `convex/usage.ts` (modify) | Connect claim uses the session's budget. |
| `convex/avatars.ts` (modify) | Ending contract and time promise only with a closing read. |
| `convex/orchestrator.ts` (modify) | Close check only with a closing read. |
| `src/components/simulation/room/RoomShell.tsx` (modify) | Budget-aware clock and copy, invitation only with a closing read. |
| `src/app/(app)/p/[practiceId]/s/[sessionId]/page.tsx` (modify) | Next-step link. |
| Tests | `src/domains/registry.test.ts`, `src/domains/sales/variant.test.ts` (create), `src/domains/sales/briefing.test.ts`, `src/domains/sales/prompts.test.ts`, `src/lib/ending.test.ts`, `src/lib/flowSteps.test.ts` (create). |

---

### Task 1: The variant contract and registry helpers

**Files:**
- Modify: `src/domains/types.ts`
- Modify: `src/domains/registry.ts`
- Test: `src/domains/registry.test.ts`

**Interfaces:**
- Produces: `PracticeVariant`, `VerdictVocabulary`, `ScopeFieldOption.hint?`, `DomainPack.variantField?`, `DomainPack.variant?`, `DomainPack.nextStep?`, `variantOf(pack: DomainPack, scope: Scope): PracticeVariant`, `lockedPersona(pack: DomainPack, variant: PracticeVariant): Persona | null`.

- [ ] **Step 1: Write the failing tests**

Append to `src/domains/registry.test.ts`:

```ts
import { lockedPersona, variantOf } from "./registry.ts"
import { ROOM_MS } from "../lib/roomClock.ts"

test("a pack without variants resolves to its own shape, whatever the scope", () => {
  const variant = variantOf(PACKS.founder, { anything: "at all" })
  assert.equal(variant.scopeFields, PACKS.founder.scopeFields)
  assert.equal(variant.prep, true)
  assert.equal(variant.personaId, null)
  assert.equal(variant.roomMinutes, ROOM_MS / 60_000)
  assert.equal(variant.closingRead, true)
  assert.equal(variant.verdicts, PACKS.founder.verdicts)
  assert.equal(variant.copy.panelLead, PACKS.founder.copy.panel.lead)
  assert.equal(variant.copy.preview, PACKS.founder.copy.preview)
  assert.equal(variant.copy.formSections, PACKS.founder.copy.form.sections)
})

test("lockedPersona is the single persona of a one-persona lane, else the variant's lock, else null", () => {
  assert.equal(lockedPersona(PACKS.audit, variantOf(PACKS.audit, {}))?.id, PACKS.audit.personas[0].id)
  assert.equal(lockedPersona(PACKS.founder, variantOf(PACKS.founder, {})), null)
  const locked = { ...variantOf(PACKS.founder, {}), personaId: PACKS.founder.personas[1].id }
  assert.equal(lockedPersona(PACKS.founder, locked)?.id, PACKS.founder.personas[1].id)
})
```

Put the two new imports at the top of the file with the existing ones.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test src/domains/registry.test.ts`
Expected: FAIL, `variantOf` is not exported.

- [ ] **Step 3: Add the types**

In `src/domains/types.ts`:

Replace `export type ScopeFieldOption = { value: string; label: string }` with:

```ts
// hint is the one-line description a chooser renders under the label; the
// chip grid ignores it.
export type ScopeFieldOption = { value: string; label: string; hint?: string }
```

After `export type VerdictOption = ...` add:

```ts
export type VerdictVocabulary = { options: VerdictOption[]; fallback: string }
```

Change the `scopeFields` comment on `DomainPack` and add the variant fields. Replace:

```ts
  scopeFields: ScopeField[]
  contextFields: ContextField[]
  // Closed verdict vocabulary. fallback is stored when model output is
  // outside it.
  verdicts: { options: VerdictOption[]; fallback: string }
```

with:

```ts
  // The lane's spoken-intake fields (what extraction can hear) and the
  // default shape for lanes without variants. Per-practice shape comes
  // from variantOf, never from this list directly.
  scopeFields: ScopeField[]
  contextFields: ContextField[]
  // Every verdict value the lane can produce, for badges and direction.
  // A variant narrows this to the values its debrief may pick.
  verdicts: VerdictVocabulary
  // Lanes whose practices come in kinds (the sales lane's call types)
  // declare the chips field whose answer picks the kind, and resolve the
  // kind's shape from the scope. Absent means one shape (variantOf).
  variantField?: string
  variant?: (scope: Scope) => PracticeVariant
  // What to practice next, given how the last session went. The intake
  // seeds from the returned scope (?from=&next=1). Null means no suggestion.
  nextStep?: (scope: Scope, verdict: string) => { label: string; scope: Scope } | null
```

Before `export type DomainPack = {` add:

```ts
// How one practice differs from its lane's default shape. Everything the
// engine reads per practice instead of per lane lives here, so adding a
// kind to a lane edits that lane's resolver and nothing else.
export type PracticeVariant = {
  scopeFields: ScopeField[]
  // Whether the read and prep stages run before the panel.
  prep: boolean
  // The one persona this practice faces; null lets the panel offer a choice.
  personaId: string | null
  roomMinutes: number
  // Whether the panelist lands a closing read (and the room may end on it).
  closingRead: boolean
  verdicts: VerdictVocabulary
  copy: {
    formSections: PackCopy["form"]["sections"]
    // Null hides the typed form's preview rail.
    preview: PackCopy["preview"] | null
    panelLead: string
  }
}
```

- [ ] **Step 4: Add the registry helpers**

In `src/domains/registry.ts`, change the type import to:

```ts
import type {
  DomainPack,
  Persona,
  PracticeVariant,
  Scope,
  VerdictOption,
  VerdictTone,
} from "./types.ts"
import { ROOM_MS } from "../lib/roomClock.ts"
```

After `getPack` add:

```ts
// The shape of one practice. Packs without variants get their own fields
// and copy back, so the engine can read a variant everywhere.
export const variantOf = (pack: DomainPack, scope: Scope): PracticeVariant =>
  pack.variant?.(scope) ?? {
    scopeFields: pack.scopeFields,
    prep: true,
    personaId: null,
    roomMinutes: ROOM_MS / 60_000,
    closingRead: true,
    verdicts: pack.verdicts,
    copy: {
      formSections: pack.copy.form.sections,
      preview: pack.copy.preview,
      panelLead: pack.copy.panel.lead,
    },
  }

// The one panelist a practice can face, when there is exactly one: the
// variant locks them, or the lane has a single persona.
export const lockedPersona = (pack: DomainPack, variant: PracticeVariant): Persona | null =>
  pack.personas.find((persona) => persona.id === variant.personaId) ??
  (pack.personas.length === 1 ? pack.personas[0] : null)
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `node --test src/domains/registry.test.ts && npx tsc --noEmit -p .`
Expected: PASS, no type errors (the `verdicts` shape is structurally identical).

- [ ] **Step 6: Stop for review**

Leave uncommitted. Run `pnpm test` to confirm nothing else moved.

---

### Task 2: The sales rulebook

**Files:**
- Create: `src/domains/sales/variant.ts`
- Modify: `src/domains/sales/pack.ts`
- Modify: `src/domains/sales/personas.ts`
- Test: `src/domains/sales/variant.test.ts` (create), `src/domains/registry.test.ts`

**Interfaces:**
- Consumes: `PracticeVariant`, `VerdictVocabulary`, `ScopeField`, `Scope`, `scopeText` from Task 1.
- Produces: `CALL_TYPE_KEY = "callType"`, `COLD_CALL = "Cold call"`, `PITCH_MEETING = "Pitch meeting"`, `callTypeField: ScopeField`, `COLD_FIELDS`, `PITCH_FIELDS`, `COLD_VERDICTS`, `PITCH_VERDICTS`, `isColdCall(scope): boolean`, `salesVariant(scope): PracticeVariant`, `salesNextStep(scope, verdict)`, `pitchPreview`, `pitchPanelLead`. Persona ids `"buyer-01"` (Cole) and `"prospect-01"` (Greg).

- [ ] **Step 1: Write the failing tests**

Create `src/domains/sales/variant.test.ts`:

```ts
import test from "node:test"
import assert from "node:assert/strict"
import {
  CALL_TYPE_KEY,
  COLD_CALL,
  PITCH_MEETING,
  isColdCall,
  salesNextStep,
  salesVariant,
} from "./variant.ts"

const keys = (scope: Record<string, string>) => salesVariant(scope).scopeFields.map((f) => f.key)

test("before a call type is chosen, the only field is the call type", () => {
  assert.deepEqual(keys({}), [CALL_TYPE_KEY])
  assert.deepEqual(keys({ [CALL_TYPE_KEY]: "nonsense" }), [CALL_TYPE_KEY])
  assert.equal(salesVariant({}).scopeFields[0].required, true)
})

test("a cold call is three short fields, no prep, Greg, two minutes, no closing read", () => {
  const variant = salesVariant({ [CALL_TYPE_KEY]: COLD_CALL })
  assert.deepEqual(keys({ [CALL_TYPE_KEY]: COLD_CALL }), [CALL_TYPE_KEY, "prospect", "offering", "goal"])
  assert.equal(variant.prep, false)
  assert.equal(variant.personaId, "prospect-01")
  assert.equal(variant.roomMinutes, 2)
  assert.equal(variant.closingRead, false)
  assert.deepEqual(
    variant.verdicts.options.map((o) => o.value),
    ["booked", "follow-up", "brushed-off"]
  )
  assert.equal(variant.verdicts.fallback, "follow-up")
  assert.equal(variant.copy.preview, null)
  // Every cold field renders: each active key belongs to a section.
  const sectioned = variant.copy.formSections.flatMap((s) => s.keys)
  for (const key of keys({ [CALL_TYPE_KEY]: COLD_CALL })) {
    if (key !== CALL_TYPE_KEY) assert.ok(sectioned.includes(key), `unsectioned ${key}`)
  }
})

test("a pitch meeting keeps today's fields, prep, Cole, five minutes, a closing read", () => {
  const variant = salesVariant({ [CALL_TYPE_KEY]: PITCH_MEETING })
  assert.deepEqual(keys({ [CALL_TYPE_KEY]: PITCH_MEETING }), [
    CALL_TYPE_KEY,
    "offering",
    "description",
    "prospect",
    "ask",
    "objections",
  ])
  assert.equal(variant.prep, true)
  assert.equal(variant.personaId, "buyer-01")
  assert.equal(variant.roomMinutes, 5)
  assert.equal(variant.closingRead, true)
  assert.deepEqual(
    variant.verdicts.options.map((o) => o.value),
    ["buy", "second-meeting", "walk"]
  )
  assert.ok(variant.copy.preview)
})

test("isColdCall reads the chosen label only", () => {
  assert.equal(isColdCall({ [CALL_TYPE_KEY]: COLD_CALL }), true)
  assert.equal(isColdCall({ [CALL_TYPE_KEY]: PITCH_MEETING }), false)
  assert.equal(isColdCall({}), false)
})

test("a booked cold call suggests the pitch meeting with offering and prospect carried over", () => {
  const next = salesNextStep(
    { [CALL_TYPE_KEY]: COLD_CALL, offering: "CourtFlow", prospect: "Owner of a 12-court club", goal: "Book a meeting" },
    "booked"
  )
  assert.ok(next)
  assert.equal(next.label, "Prep the meeting with Cole")
  assert.deepEqual(next.scope, {
    [CALL_TYPE_KEY]: PITCH_MEETING,
    offering: "CourtFlow",
    prospect: "Owner of a 12-court club",
  })
})

test("no suggestion for a pitch meeting, or a cold call that did not book", () => {
  assert.equal(salesNextStep({ [CALL_TYPE_KEY]: PITCH_MEETING }, "buy"), null)
  assert.equal(salesNextStep({ [CALL_TYPE_KEY]: COLD_CALL }, "follow-up"), null)
  assert.equal(salesNextStep({ [CALL_TYPE_KEY]: COLD_CALL }, "brushed-off"), null)
})
```

In `src/domains/registry.test.ts`, extend the verdict-distinctness test. It already flattens `pack.verdicts.options` across packs, so the union on the sales pack is covered once the pack changes. Add one sales assertion test:

```ts
test("the sales lane's call types pick the buyer and the vocabulary", () => {
  assert.equal(PACKS.sales.variantField, "callType")
  assert.deepEqual(
    PACKS.sales.personas.map((persona) => persona.id),
    ["buyer-01", "prospect-01"]
  )
  assert.deepEqual(
    PACKS.sales.verdicts.options.map((option) => option.value),
    ["buy", "second-meeting", "walk", "booked", "follow-up", "brushed-off"]
  )
  assert.equal(PACKS.sales.sessionMetaField, "callType")
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test src/domains/sales/variant.test.ts src/domains/registry.test.ts`
Expected: FAIL, module `./variant.ts` not found; sales assertions fail.

- [ ] **Step 3: Create the rulebook**

Create `src/domains/sales/variant.ts`:

```ts
import {
  scopeText,
  type PackCopy,
  type PracticeVariant,
  type Scope,
  type ScopeField,
  type VerdictVocabulary,
} from "../types.ts"
import { OBJECTIONS } from "./objections.ts"

// The sales lane's two call types. A cold call is a stranger picking up
// the phone; a pitch meeting is the buyer who read your materials. The
// engine never sees these names; it reads salesVariant.

export const CALL_TYPE_KEY = "callType"
export const COLD_CALL = "Cold call"
export const PITCH_MEETING = "Pitch meeting"

export const callTypeField: ScopeField = {
  key: CALL_TYPE_KEY,
  label: "What kind of call is this?",
  kind: "chips",
  required: true,
  options: [
    {
      value: "cold",
      label: COLD_CALL,
      hint: "They don't know you're calling. You get two minutes to earn more.",
    },
    {
      value: "pitch",
      label: PITCH_MEETING,
      hint: "They've read your materials and made time. Five minutes, then a verdict.",
    },
  ],
}

// The voice path extracts these; the typed form renders them after the
// call type. Shared with the pack's scopeFields so extraction and the
// pitch variant can never drift apart.
export const PITCH_INTAKE_FIELDS: ScopeField[] = [
  {
    key: "offering",
    label: "What you're selling",
    kind: "text",
    required: true,
    maxLength: 60,
    placeholder: "e.g. CourtFlow scheduling",
  },
  {
    key: "description",
    label: "What it does",
    kind: "textarea",
    required: true,
    maxLength: 600,
    placeholder: "What it does and the problem it removes, in a couple of lines",
  },
  {
    key: "prospect",
    label: "Who you're pitching",
    kind: "text",
    required: true,
    maxLength: 80,
    placeholder: "e.g. Facilities manager at a mid-size gym",
  },
  {
    key: "ask",
    label: "What you're asking them to say yes to",
    kind: "chips",
    options: [
      { value: "discovery", label: "A discovery call" },
      { value: "pilot", label: "A pilot" },
      { value: "paid-pilot", label: "A paid pilot" },
      { value: "partnership", label: "A partnership" },
      { value: "contract", label: "A signed contract" },
    ],
  },
  {
    key: "objections",
    label: "Objections you expect",
    kind: "multi",
    options: OBJECTIONS.map((objection) => ({
      value: objection.label,
      label: objection.label,
    })),
  },
]

export const PITCH_FIELDS: ScopeField[] = [callTypeField, ...PITCH_INTAKE_FIELDS]

export const COLD_FIELDS: ScopeField[] = [
  callTypeField,
  {
    key: "prospect",
    label: "Who are you calling?",
    kind: "text",
    required: true,
    maxLength: 80,
    placeholder: "e.g. Owner of a 12-truck HVAC company",
  },
  {
    key: "offering",
    label: "What do you sell?",
    kind: "text",
    required: true,
    maxLength: 60,
    placeholder: "e.g. Dispatch software for service fleets",
  },
  {
    key: "goal",
    label: "What do you want from this call?",
    kind: "chips",
    required: true,
    options: [
      { value: "meeting", label: "Book a meeting" },
      { value: "follow-up", label: "Permission to follow up" },
      { value: "close", label: "A yes on the spot" },
    ],
  },
]

export const PITCH_VERDICTS: VerdictVocabulary = {
  options: [
    { value: "buy", label: "Would buy", tone: "good" },
    { value: "second-meeting", label: "Second meeting", tone: "mid" },
    { value: "walk", label: "Would walk", tone: "bad" },
  ],
  fallback: "second-meeting",
}

export const COLD_VERDICTS: VerdictVocabulary = {
  options: [
    { value: "booked", label: "Booked", tone: "good" },
    { value: "follow-up", label: "Follow-up granted", tone: "mid" },
    { value: "brushed-off", label: "Brushed off", tone: "bad" },
  ],
  fallback: "follow-up",
}

export const pitchFormSections: PackCopy["form"]["sections"] = [
  { title: "The deal", keys: ["offering", "description", "prospect"] },
  { title: "The ask", keys: ["ask", "objections"] },
]

const coldFormSections: PackCopy["form"]["sections"] = [
  { title: "The call", keys: ["prospect", "offering", "goal"] },
]

export const pitchPreview: PackCopy["preview"] = {
  title: "What Cole will read",
  rows: [
    { key: "offering", label: "Selling", hint: "Not yet named" },
    { key: "description", label: "What it does", hint: "The problem it removes, in Cole's terms" },
    { key: "prospect", label: "Across the table", hint: "Who Cole is playing" },
  ],
  chips: { label: "Ask and objections", keys: ["ask", "objections"] },
  footer: "Only what you put here makes it in; gaps become questions, not guesses.",
}

export const pitchPanelLead =
  "The buyer reads your scope and materials before the room opens. Expect the objections you named, and a few you didn't."

const coldPanelLead =
  "Greg doesn't know you're calling and hasn't read a thing. He picks up, you talk, and he decides whether you get thirty seconds more."

export const isColdCall = (scope: Scope): boolean => scopeText(scope, CALL_TYPE_KEY) === COLD_CALL

export const salesVariant = (scope: Scope): PracticeVariant => {
  if (isColdCall(scope)) {
    return {
      scopeFields: COLD_FIELDS,
      prep: false,
      personaId: "prospect-01",
      roomMinutes: 2,
      closingRead: false,
      verdicts: COLD_VERDICTS,
      copy: { formSections: coldFormSections, preview: null, panelLead: coldPanelLead },
    }
  }
  const chosen = scopeText(scope, CALL_TYPE_KEY) === PITCH_MEETING
  return {
    scopeFields: chosen ? PITCH_FIELDS : [callTypeField],
    prep: true,
    personaId: "buyer-01",
    roomMinutes: 5,
    closingRead: true,
    verdicts: PITCH_VERDICTS,
    copy: { formSections: pitchFormSections, preview: pitchPreview, panelLead: pitchPanelLead },
  }
}

// A booked cold call earns the meeting: prep it with Cole, with what the
// seller already typed carried over.
export const salesNextStep = (
  scope: Scope,
  verdict: string
): { label: string; scope: Scope } | null =>
  isColdCall(scope) && verdict === "booked"
    ? {
        label: "Prep the meeting with Cole",
        scope: {
          [CALL_TYPE_KEY]: PITCH_MEETING,
          offering: scopeText(scope, "offering"),
          prospect: scopeText(scope, "prospect"),
        },
      }
    : null
```

- [ ] **Step 4: Wire the pack**

In `src/domains/sales/pack.ts`:

Replace the imports with:

```ts
import { BUYER_PERSONAS } from "./personas.ts"
import type { DomainPack } from "../types.ts"
import { buildRoomBriefing, turnTaking } from "./briefing.ts"
import { analyzeSystem, analyzeUser, audit, debrief, extractScope, orchestrate } from "./prompts.ts"
import {
  CALL_TYPE_KEY,
  COLD_VERDICTS,
  PITCH_INTAKE_FIELDS,
  PITCH_VERDICTS,
  pitchFormSections,
  pitchPanelLead,
  pitchPreview,
  salesNextStep,
  salesVariant,
} from "./variant.ts"
```

Replace the whole `scopeFields: [ ... ]` array with `scopeFields: PITCH_INTAKE_FIELDS,`.

Replace the `verdicts: { ... }` block with:

```ts
  verdicts: {
    options: [...PITCH_VERDICTS.options, ...COLD_VERDICTS.options],
    fallback: PITCH_VERDICTS.fallback,
  },
  sessionMetaField: CALL_TYPE_KEY,
  variantField: CALL_TYPE_KEY,
  variant: salesVariant,
  nextStep: salesNextStep,
```

In `copy.form`, replace the `sections: [ ... ]` array with `sections: pitchFormSections,`. Replace the whole `preview: { ... }` block with `preview: pitchPreview,`. In `copy.panel`, replace the `lead: "..."` line with `lead: pitchPanelLead,`.

Update the description so it covers both calls:

```ts
  description:
    "Face the buyer before the real one. Cold-call a stranger who never asked to hear from you, or pitch the operator who read your materials, then get debriefed on whether the deal moved.",
```

- [ ] **Step 5: Cole's card**

In `src/domains/sales/personas.ts`, replace Cole's `role`, `tone`, `bio`, and `signature`:

```ts
    role: "Owns the process you're asking them to change",
    shortRole: "The buyer",
    tone: "Warm but immovable, guards the team's time, has sat through a hundred vendor pitches",
```

```ts
    bio: "Plays whoever you're pitching, from the inside of that operation. Has bought a dozen tools that worked and ripped out three that didn't. Likes ideas fine; buys outcomes, references, and a next step worth the calendar slot.",
```

Keep `attack`, `tags`, and `signature` as they are.

- [ ] **Step 6: Run the tests and typecheck**

Run: `pnpm test && npx tsc --noEmit -p .`
Expected: PASS. The existing `prompts.test.ts` extraction test iterates `salesPack.scopeFields`, which is still the five spoken fields, so it holds.

- [ ] **Step 7: Stop for review**

Leave uncommitted.

---

### Task 3: Ending helpers with minutes

**Files:**
- Modify: `src/lib/ending.ts`
- Test: `src/lib/ending.test.ts`

**Interfaces:**
- Produces: `withTimeContract(startScript: string, minutes: number): string`, `minutesPhrase(minutes: number): string` ("a minute", "two minutes", "five minutes").

- [ ] **Step 1: Write the failing tests**

In `src/lib/ending.test.ts`, replace the `withTimeContract` test with:

```ts
test("startScript contract words the room's minutes and stays inside Runway's 2000-char limit", () => {
  const nearCap = "x".repeat(1_990)
  assert.equal(withTimeContract(nearCap, 5), nearCap)
  assert.ok(withTimeContract("Welcome.", 5).includes("up to five minutes"))
  assert.ok(withTimeContract("Welcome.", 2).includes("up to two minutes"))
  assert.ok(withTimeContract("Welcome.", 1).includes("up to a minute"))
  assert.ok(withTimeContract("Welcome.", 5).length <= 2_000)
})

test("minutesPhrase reads like speech", () => {
  assert.equal(minutesPhrase(1), "a minute")
  assert.equal(minutesPhrase(2), "two minutes")
  assert.equal(minutesPhrase(5), "five minutes")
  assert.equal(minutesPhrase(7), "7 minutes")
})
```

Add `minutesPhrase` to the import line.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test src/lib/ending.test.ts`
Expected: FAIL, `minutesPhrase` not exported; the two-minute assertion fails.

- [ ] **Step 3: Implement**

In `src/lib/ending.ts`, after `MINUTE_WORDS` add:

```ts
// Spoken minutes: "a minute", "two minutes". Shared by the start script
// and the room's connecting copy so they can never disagree.
export const minutesPhrase = (minutes: number): string =>
  minutes === 1 ? "a minute" : `${MINUTE_WORDS[minutes] ?? String(minutes)} minutes`
```

Replace `withTimeContract`:

```ts
export const withTimeContract = (startScript: string, minutes: number): string => {
  // Promises the time limit without priming a rush: "on the clock" read as
  // urgency and showed up live as a three minute close. "Up to", not a flat
  // number, and "make them count", not "use every one" — the room lands when
  // the close is delivered, so nothing spoken may promise the full budget.
  const contract = ` We have the room for up to ${minutesPhrase(minutes)}, so let's make them count.`
  const combined = `${startScript}${contract}`
  return combined.length <= 2_000 ? combined : startScript
}
```

- [ ] **Step 4: Fix the one caller**

`convex/avatars.ts` calls `withTimeContract(briefing.startScript)`. Task 8 rewrites that line; for now pass `roomMinutes`, which is already in scope there:

```ts
        startScript: withTimeContract(briefing.startScript, roomMinutes),
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `node --test src/lib/ending.test.ts && npx tsc --noEmit -p .`
Expected: PASS.

- [ ] **Step 6: Stop for review**

Leave uncommitted.

---

### Task 4: The cold-call briefing

**Files:**
- Modify: `src/domains/sales/briefing.ts`
- Test: `src/domains/sales/briefing.test.ts`

**Interfaces:**
- Consumes: `isColdCall`, `CALL_TYPE_KEY`, `COLD_CALL` from Task 2.
- Produces: `buildRoomBriefing` unchanged in signature; returns the cold briefing when the scope is a cold call.

- [ ] **Step 1: Write the failing tests**

Append to `src/domains/sales/briefing.test.ts`:

```ts
import { CALL_TYPE_KEY, COLD_CALL } from "./variant.ts"

const coldScope = {
  [CALL_TYPE_KEY]: COLD_CALL,
  prospect: "Owner of a 12-truck HVAC company",
  offering: "Dispatch software for service fleets",
  goal: "Book a meeting",
}

test("a cold call casts the avatar as the prospect and tells them nothing about the caller", () => {
  const briefing = buildRoomBriefing({ scope: coldScope, audit: null, continuity: null, transcript: [] })
  assert.match(briefing.personalityPreamble, /Owner of a 12-truck HVAC company/)
  assert.doesNotMatch(briefing.personalityPreamble, /Dispatch software/)
  assert.doesNotMatch(briefing.personalityPreamble, /Book a meeting/)
  assert.match(briefing.personalityPreamble, /cold call/i)
  assert.match(briefing.personalityPreamble, /do not hang up/i)
  assert.doesNotMatch(briefing.startScript, /minute/)
  assert.match(briefing.startScript, /this is Greg/)
})

test("a cold call ignores audit and continuity: a stranger has read nothing and remembers nothing", () => {
  const briefing = buildRoomBriefing({
    scope: coldScope,
    audit: { claims: [claim()], gaps: [gap("No pricing anywhere")] },
    continuity: { lastSessionSummary: "Went well", actionItems: [], updatedAt: 0 },
    transcript: [],
  })
  assert.doesNotMatch(briefing.personalityPreamble, /No pricing anywhere/)
  assert.doesNotMatch(briefing.personalityPreamble, /earlier session/)
  assert.doesNotMatch(briefing.startScript, /read through/)
})

test("a resumed cold call picks the call back up without a re-introduction", () => {
  const briefing = buildRoomBriefing({
    scope: coldScope,
    audit: null,
    continuity: null,
    transcript: [
      { text: "Hi Greg, this is Dana from FleetPath.", type: "user", timestamp: 1 },
      { text: "What's this about?", type: "panelist", timestamp: 2 },
    ],
  })
  assert.match(briefing.personalityPreamble, /What's this about\?/)
  assert.match(briefing.personalityPreamble, /Do not introduce yourself again/)
  assert.doesNotMatch(briefing.startScript, /this is Greg/)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test src/domains/sales/briefing.test.ts`
Expected: FAIL, the cold preamble contains the offering and no "cold call" text.

- [ ] **Step 3: Implement the cold branch**

In `src/domains/sales/briefing.ts`, add the import:

```ts
import { isColdCall } from "./variant.ts"
```

Extract the resume digest so both branches share it. Replace the `if (transcript.length > 0) { ... }` block with a helper above `buildRoomBriefing` and a call inside it:

```ts
const resumeDigest = (transcript: BriefingInput["transcript"]): string =>
  bySpokenTime(transcript)
    .slice(-DIGEST_TURNS)
    .map((e) => `${e.type === "user" ? "SELLER" : "YOU"}: ${e.text.slice(0, DIGEST_TURN_CHARS)}`)
    .join("\n")

// A cold call: the prospect knows only who they are. No materials, no
// gaps, no ask, no memory of earlier sessions; the seller's offer is what
// the call is for them to find out. The no-hang-up rules live here rather
// than on the Character so the room's ending stays the clock's.
const buildColdCallBriefing = ({ scope, transcript }: BriefingInput): RoomBriefing => {
  const prospect = scopeText(scope, "prospect")
  if (transcript.length > 0) {
    return {
      personalityPreamble: `Session context: this resumes a cold call that dropped mid-conversation. Do not introduce yourself again and do not repeat what you already said. The recent exchange:\n${resumeDigest(transcript)}\nPick the call back up from there.\n\n`,
      startScript: "Sorry, lost you for a second. You were saying?",
    }
  }
  return {
    personalityPreamble: composeWithinBudget([
      `Session context: this is a cold call. You are ${prospect}. You did not expect this call and you know nothing about the caller, their company, or what they sell until they tell you; never pretend otherwise. You have read no materials and have no history with this person.`,
      ` You do not hang up. If the caller gives you no reason to stay after a couple of exchanges, say you have to get back to it and give them one last chance; if they waste it, stay on the line but stop helping: short brush-offs, no questions, no agreements. Never coach or explain what they should have done.`,
    ]) + "\n\n",
    startScript: "Yeah, this is Greg.",
  }
}
```

Then, at the top of `buildRoomBriefing`, before the existing destructuring uses anything:

```ts
export const buildRoomBriefing = (input: BriefingInput): RoomBriefing => {
  if (isColdCall(input.scope)) return buildColdCallBriefing(input)
  const { scope, audit, continuity, transcript } = input
```

and in the existing resume branch replace the inline digest with `const digest = resumeDigest(transcript)`.

- [ ] **Step 4: Run the tests**

Run: `node --test src/domains/sales/briefing.test.ts && npx tsc --noEmit -p .`
Expected: PASS, including the existing pitch tests.

- [ ] **Step 5: Stop for review**

Leave uncommitted.

---

### Task 5: Cold-call orchestrate and debrief prompts

**Files:**
- Modify: `src/domains/sales/prompts.ts`
- Test: `src/domains/sales/prompts.test.ts`

**Interfaces:**
- Consumes: `isColdCall`, `COLD_VERDICTS` from Task 2.
- Produces: `orchestrate` and `debrief` unchanged in signature; cold-call branches.

- [ ] **Step 1: Write the failing tests**

Append to `src/domains/sales/prompts.test.ts`:

```ts
import { CALL_TYPE_KEY, COLD_CALL } from "./variant.ts"

const coldScope: Scope = {
  [CALL_TYPE_KEY]: COLD_CALL,
  prospect: "Owner of a 12-truck HVAC company",
  offering: "Dispatch software for service fleets",
  goal: "Book a meeting",
}

const persona = {
  characterName: "Greg Hollis",
  characterRole: "Owner-operator, small local business",
  characterTone: "Busy, polite, distracted at first",
}

test("the cold-call note-taker watches the opener, the brush-offs, and the ask, not the objection catalog", () => {
  const prompt = orchestrate({ ...persona, scope: coldScope })
  assert.match(prompt, /cold call/i)
  assert.match(prompt, /Book a meeting/)
  assert.match(prompt, /thirty seconds/i)
  assert.doesNotMatch(prompt, /Common buyer objections/)
  assert.match(prompt, /"note":\{"type"/)
})

test("the cold-call debrief judges against the goal and picks only cold outcomes", () => {
  const prompt = debrief({
    ...persona,
    scope: coldScope,
    notes: "(none)",
    transcript: "SELLER: hi\nGREG HOLLIS: what's this about",
    continuity: null,
  })
  assert.match(prompt, /"booked" \| "follow-up" \| "brushed-off"/)
  assert.doesNotMatch(prompt, /"second-meeting"/)
  assert.match(prompt, /Book a meeting/)
  assert.match(prompt, /opener/i)
  assert.match(prompt, /brush-off/i)
  assert.match(prompt, /Never use em dashes/)
  assert.match(prompt, /"heldUp"/)
  assert.match(prompt, /"continuity"/)
})

test("the pitch-meeting debrief is untouched by the cold vocabulary", () => {
  const prompt = debrief({
    ...persona,
    scope,
    notes: "(none)",
    transcript: "SELLER: hi",
    continuity: null,
  })
  assert.match(prompt, /"buy" \| "second-meeting" \| "walk"/)
  assert.doesNotMatch(prompt, /"booked"/)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test src/domains/sales/prompts.test.ts`
Expected: FAIL on the cold assertions.

- [ ] **Step 3: Implement**

In `src/domains/sales/prompts.ts`, add the import:

```ts
import { isColdCall } from "./variant.ts"
```

Add a cold scope block after `scopeBlock`:

```ts
const coldScopeBlock = (scope: Scope) =>
  `- Who they called: ${scopeText(scope, "prospect")}
- What they sell: ${scopeText(scope, "offering")}
- What they wanted from the call: ${scopeText(scope, "goal")}`
```

Add the cold orchestrate prompt above `orchestrate` and branch at its top:

```ts
const orchestrateColdCall = ({ characterName, characterRole, scope }: OrchestratePromptInput) =>
  `You are observing a live cold call. ${characterName} (${characterRole}) picked up a call they were not expecting; the seller is trying to earn their time. Take notes in real time.

Call context (the seller's side, which ${characterName} does not know):
${coldScopeBlock(scope)}

What you listen for: whether the opener says who is calling and why in one breath; whether the seller earns thirty seconds by saying something true about businesses like this one; whether they ask a question instead of pitching; how they handle each brush-off ("send me an email", "we've got somebody", "not a good time", "how much"); and whether they ask clearly for one specific thing before the call runs out. A strong turn is short, specific, and about the prospect. A weak one is a monologue, a script, or an argument with a no.

Produce ONE short observation (8-18 words) about the most recent seller turn, or null if the turn contains nothing worth noting. Classify it:
- strong_answer: the seller earned more time with something specific. Only when their own words demonstrably earn it; when unsure, no note
- weak_assumption: the seller assumed something about the prospect that the prospect did not confirm
- objection: the prospect brushed the seller off
- follow_up: an ask or question still hanging
- event: a notable shift, such as the prospect warming up or going flat

Also name the topic being discussed right now, in 5 words or fewer. Use null if it is unclear.

Respond with JSON only, exactly this shape:
{"note":{"type":"<one_of_the_five>","text":"<8-18 word observation>"} | null,"topic":"<5 words or fewer>" | null}`
```

Change `orchestrate` to branch first:

```ts
export const orchestrate = (input: OrchestratePromptInput) => {
  if (isColdCall(input.scope)) return orchestrateColdCall(input)
  const { characterName, characterRole, characterTone, scope } = input
  return `You are observing a live sales pitch ...` // the existing template, unchanged
}
```

Add the cold debrief prompt above `debrief` and branch the same way:

```ts
const debriefColdCall = ({
  scope,
  characterName,
  characterRole,
  characterTone,
  notes,
  transcript,
  continuity,
}: DebriefPromptInput) =>
  `You are a sales coach synthesizing a live cold call into a debrief.

The seller's side of the call:
${coldScopeBlock(scope)}
${engagementBlock(continuity)}
Prospect who took the call: ${characterName} (${characterRole})
Prospect's disposition: ${characterTone}

Live notes observed during the call:
${notes}

Call transcript:
${transcript}

Produce the debrief. Return JSON ONLY with this exact shape:
{
  "title": "<a 2-4 word name for this call, e.g. \\"Earned the callback\\">",
  "verdict": {
    "decision": "booked" | "follow-up" | "brushed-off",
    "summary": "one-sentence rationale"
  },
  "spokenVerdict": "<what ${characterName} would say about this call to a colleague after hanging up, in one breath, 120 to 160 characters of plain direct speech in their voice, no lists, no headings>",
  "whatHappened": "<one paragraph, 60-120 words, addressed to the seller in the second person (\\"You opened with…\\"): the opener, whether it earned thirty seconds, how each brush-off was handled, and what the call ended on>",
  "heldUp": [
    {"quote": "<the seller's exact words from the transcript, copied verbatim>",
     "why": "<one line on why it earned time>"}
  ],
  "didntHold": [
    {"text": "<a line that lost the prospect, a brush-off that was argued with, or the ask that never came, short>", "ref": null}
  ],
  "continuity": {
    "summary": "<2-4 sentences a colleague could read before the next attempt: what the opener was, what the prospect reacted to, what to change>",
    "actionItems": [
      {"text": "<one concrete change for the next call, starts with a verb, under 15 words>", "priority": "high" | "medium" | "low"}
    ]
  }
}

"heldUp" holds 0 to 3 items; "didntHold" holds 0 to 4. "ref" is always null in this lane.

Judge the outcome against what the seller wanted (${scopeText(scope, "goal")}): "booked" only when the prospect agreed to a specific next step the seller asked for; "follow-up" when the prospect allowed an email or a call back without committing; "brushed-off" when the call ended with nothing, or the prospect said they had to go. "Send me some info" offered by the prospect is a brush-off unless the seller turned it into a specific follow-up.

CALIBRATION. The seller's trust depends on honest feedback; never inflate:
- Judge only what the transcript shows. Every sentence of "whatHappened" must trace to actual turns; never credit intent, effort, or content that did not occur.
- If the seller said little or nothing, "whatHappened" is one plain sentence saying exactly that, the decision is "brushed-off", and "spokenVerdict" is ${characterName}'s honest reaction. "spokenVerdict" is always a judgment of the seller's call, never a restatement of something ${characterName} asked.
- Outcomes are earned: "booked" only when the transcript demonstrates it. Torn between two tiers? Choose the lower.
- "didntHold" names what actually went wrong on THIS call, not a best-practices checklist. Two real findings beat four generic ones.
- Write plainly. Never use em dashes in any output field.

Be concrete and specific: every line should mention something tied to THIS seller's opener, offer, and prospect, not generic advice.

Grounding rules (absolute):
- "heldUp" may contain ONLY things the seller actually said that earned the prospect's time, each quoted verbatim in "quote". If nothing earned time, return "heldUp": [].
- Advice and recommendations belong ONLY in "continuity" action items, never in "heldUp".
- Nowhere in the debrief state specifics the transcript does not contain (numbers, business details, prices). Where the seller provided nothing, say so plainly.`
```

```ts
export const debrief = (input: DebriefPromptInput) => {
  if (isColdCall(input.scope)) return debriefColdCall(input)
  const { scope, characterName, characterRole, characterTone, notes, transcript, continuity } = input
  return `You are a sales coach synthesizing a live pitch session ...` // the existing template, unchanged
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test src/domains/sales/prompts.test.ts && npx tsc --noEmit -p .`
Expected: PASS, existing pitch pins included.

- [ ] **Step 5: Stop for review**

Leave uncommitted.

---

### Task 6: Flow steps and the rail

**Files:**
- Create: `src/lib/flowSteps.ts`
- Create: `src/lib/flowSteps.test.ts`
- Modify: `src/components/simulation/flow/FlowShell.tsx`

**Interfaces:**
- Consumes: `variantOf` from Task 1.
- Produces: `FlowStage`, `FlowStep = { label: string; keys: FlowStage[] }`, `flowSteps(pack: DomainPack | null, scope: Scope): FlowStep[]`. `FlowShell` gains an optional `scope?: Scope` prop and re-exports `FlowStage`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/flowSteps.test.ts`:

```ts
import test from "node:test"
import assert from "node:assert/strict"
import { flowSteps } from "./flowSteps.ts"
import { PACKS } from "../domains/registry.ts"
import { CALL_TYPE_KEY, COLD_CALL, PITCH_MEETING } from "../domains/sales/variant.ts"

const labels = (steps: ReturnType<typeof flowSteps>) => steps.map((step) => step.label)

test("the rail shows the lane's pre-read step, named by the lane, when the practice has prep", () => {
  assert.deepEqual(labels(flowSteps(PACKS.founder, {})), ["Brief", "Pre-read", "Panel", "Room"])
  assert.deepEqual(labels(flowSteps(PACKS.interview, {})), ["Brief", "Blueprint", "Panel", "Room"])
  assert.deepEqual(labels(flowSteps(PACKS.sales, { [CALL_TYPE_KEY]: PITCH_MEETING })), [
    "Brief",
    "Pre-read",
    "Panel",
    "Room",
  ])
})

test("a no-prep practice drops the pre-read step, and the read/audit stages with it", () => {
  const steps = flowSteps(PACKS.sales, { [CALL_TYPE_KEY]: COLD_CALL })
  assert.deepEqual(labels(steps), ["Brief", "Panel", "Room"])
  assert.ok(!steps.some((step) => step.keys.includes("read") || step.keys.includes("audit")))
})

test("before the pack is known the rail assumes the full four steps", () => {
  assert.deepEqual(labels(flowSteps(null, {})), ["Brief", "Pre-read", "Panel", "Room"])
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/lib/flowSteps.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Create `src/lib/flowSteps.ts`:

```ts
import type { DomainPack, Scope } from "../domains/types.ts"
import { variantOf } from "../domains/registry.ts"

export type FlowStage = "brief" | "read" | "audit" | "panel" | "room"
export type FlowStep = { label: string; keys: FlowStage[] }

// The progress rail. The middle beat's name comes from the lane, and a
// practice without prep has no middle beat at all. Null pack = the frame
// before the practice loads, which assumes the common shape.
export const flowSteps = (pack: DomainPack | null, scope: Scope): FlowStep[] => {
  const prep: FlowStep[] =
    pack && !variantOf(pack, scope).prep
      ? []
      : [{ label: pack?.prep.stepLabel ?? "Pre-read", keys: ["read", "audit"] }]
  return [{ label: "Brief", keys: ["brief"] }, ...prep, { label: "Panel", keys: ["panel"] }, { label: "Room", keys: ["room"] }]
}
```

In `src/components/simulation/flow/FlowShell.tsx`:

Replace `export type FlowStage = "brief" | "read" | "audit" | "panel" | "room"` with:

```ts
import { flowSteps, type FlowStage } from "@/lib/flowSteps"
import type { Scope } from "@/domains/types"

export type { FlowStage }
```

(place the imports with the others). Add `scope?: Scope` to `FlowShellProps` with the comment `// The brief stage's in-progress scope; later stages read the practice's.` and destructure it.

Replace the `displaySteps` literal with:

```ts
  const displaySteps = flowSteps(pack, scope ?? practice?.scope ?? {})
```

Update the comment above the `practice` query: the rail now needs the practice's pack and scope. The `packId || !simulationId ? "skip"` condition stays as is: on the brief stage the page passes `scope`; on later stages the practice supplies it.

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test src/lib/flowSteps.test.ts && npx tsc --noEmit -p . && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Stop for review**

Leave uncommitted.

---

### Task 7: Server: create, session budget, and schema

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/practices.ts`
- Modify: `convex/sessions.ts`
- Modify: `convex/usage.ts`

**Interfaces:**
- Consumes: `variantOf` (Task 1).
- Produces: `sessions.roomMs?: number`; `insertSessionForPersona(ctx, practice: Doc<"practices">, pack, personaId)`.

No unit tests reach Convex functions in this repo. Verification is typecheck plus a dev push.

- [ ] **Step 1: Schema**

In `convex/schema.ts`, in the `sessions` table after `roomStartedAt`, add:

```ts
    // This session's room budget, stamped at insert from the practice's
    // variant. Sessions from before the field ran the default (ROOM_MS).
    roomMs: v.optional(v.number()),
```

- [ ] **Step 2: `practices.create` validates against the variant**

In `convex/practices.ts`, add `variantOf` to the registry import:

```ts
import { getPack, isPackId, variantOf } from "../src/domains/registry"
```

In `create`, replace `for (const field of pack.scopeFields) {` with:

```ts
    // The variant is resolved from the raw scope on purpose: an unknown or
    // missing call type resolves to the pre-choice shape, whose only field
    // is the required chooser, so a bypassed client fails on it.
    const variant = variantOf(pack, args.scope)
    for (const field of variant.scopeFields) {
```

Replace the insert and everything after it with:

```ts
    // A practice without prep is ready the moment it exists: no read, no
    // audit, and nothing to schedule. It also takes no materials; the form
    // never offers them, so any here is a bypass.
    if (!variant.prep && (args.materials ?? []).length > 0) {
      throw new Error("This practice takes no materials")
    }

    const practiceId = await ctx.db.insert("practices", {
      userId: identity.subject,
      name,
      packId: pack.id,
      status: variant.prep ? "draft" : "ready",
      scope,
    })
    if (!variant.prep) return practiceId

    for (const upload of args.materials ?? []) {
      // ... existing loop, unchanged
    }

    if ((args.materials ?? []).length === 0) {
      // ... existing prep scheduling, unchanged
    }

    return practiceId
```

Keep the existing comment blocks on the loop and the scheduling.

- [ ] **Step 3: `insertSessionForPersona` takes the practice and stamps the budget**

In `convex/sessions.ts`, change the signature and body:

```ts
export const insertSessionForPersona = async (
  ctx: MutationCtx,
  practice: Doc<"practices">,
  pack: DomainPack,
  personaId: string
): Promise<Id<"sessions">> => {
  const persona = pack.personas.find((p) => p.id === personaId)
  if (!persona) throw new Error("Unknown persona")
  const avatar = await ctx.db
    .query("avatars")
    .withIndex("by_pack_persona", (q) => q.eq("packId", pack.id).eq("personaId", persona.id))
    .first()
  if (!avatar) throw new Error("No avatar registered for this panelist")
  const sessionId = await ctx.db.insert("sessions", {
    practiceId: practice._id,
    userId: practice.userId,
    persona: {
      id: persona.id,
      archetypeId: persona.archetypeId,
      name: persona.name,
      role: persona.role,
      tone: persona.tone,
      avatarId: avatar.runwayAvatarId,
    },
    roomMs: variantOf(pack, practice.scope).roomMinutes * 60_000,
    transcript: [],
    liveNotes: [],
    status: "live",
  })
  // Rollup sync for practices.list: this is the only sessions insert site,
  // so counting here keeps the denormalized fields truthful by construction.
  await ctx.db.patch(practice._id, {
    sessionCount: (practice.sessionCount ?? 0) + 1,
    lastSessionAt: Date.now(),
  })
  return sessionId
}
```

Add `variantOf` to the registry import in `convex/sessions.ts` and make sure `Doc` is imported from `./_generated/dataModel`. Update the comment above the function: the practice is passed in because both callers already hold the owned document.

Update the two callers:

`convex/sessions.ts` `create`:

```ts
    const sessionId = await insertSessionForPersona(
      ctx,
      practice,
      getPack(practice.packId),
      args.personaId
    )
```

`convex/practices.ts` `continueSession`:

```ts
    const sessionId = await insertSessionForPersona(
      ctx,
      practice,
      getPack(practice.packId),
      practice.personaId
    )
```

- [ ] **Step 4: The time check and the connect claim read the session's budget**

In `convex/sessions.ts` `verifiedEndedReason`, replace `ROOM_MS - TIME_SLACK_MS` with `(session.roomMs ?? ROOM_MS) - TIME_SLACK_MS`.

In `convex/usage.ts` `claimAvatarConnect`, replace `maxDurationSec(session.roomStartedAt, now)` with `maxDurationSec(session.roomStartedAt, now, session.roomMs)`. (`maxDurationSec` defaults its third parameter, so `undefined` keeps the old budget.)

- [ ] **Step 5: The debrief validates against the variant's verdicts**

In `convex/sessions.ts` `generateDebrief`, replace the `parseDebrief` options:

```ts
    const { verdicts } = variantOf(pack, practice.scope)
    const parsed = parseDebrief(JSON.parse(content), {
      verdictValues: verdicts.options.map((option) => option.value),
      fallbackVerdict: verdicts.fallback,
      lowestVerdict:
        verdicts.options.find((option) => option.tone === "bad")?.value ?? verdicts.fallback,
      userTurns,
    })
```

- [ ] **Step 6: Typecheck and push to dev**

Run: `npx tsc --noEmit -p . && npx convex dev --once`
Expected: no type errors; "Convex functions ready".

- [ ] **Step 7: Stop for review**

Leave uncommitted.

---

### Task 8: Server: the room's instructions and the close check

**Files:**
- Modify: `convex/avatars.ts`
- Modify: `convex/orchestrator.ts`

**Interfaces:**
- Consumes: `variantOf`, `withTimeContract(startScript, minutes)`.

- [ ] **Step 1: The mint appends the ending contract only with a closing read**

In `convex/avatars.ts`, add `variantOf` to the registry import. Replace:

```ts
    const roomMinutes = Math.max(1, Math.floor(claim.maxDurationSec / 60))
    const contract = endingContract(firstNameOf(session.persona.name), roomMinutes)
```

with:

```ts
    const roomMinutes = Math.max(1, Math.floor(claim.maxDurationSec / 60))
    // A room without a closing read (a cold call) gets no ending contract
    // and no spoken time promise: the prospect never "calls time", the
    // clock does. The pack's briefing carries that variant's own rules.
    const { closingRead } = variantOf(pack, practice.scope)
    const contract = closingRead ? endingContract(firstNameOf(session.persona.name), roomMinutes) : ""
```

Move `const pack = getPack(practice.packId)` above this block (it currently sits just before `pack.briefing`). Replace the `startScript` line with:

```ts
        startScript: closingRead
          ? withTimeContract(briefing.startScript, roomMinutes)
          : briefing.startScript,
```

- [ ] **Step 2: The close check runs only with a closing read**

In `convex/orchestrator.ts`, add `variantOf` to the registry import. After `const pack = getPack(practice.packId)` add:

```ts
    // Nothing lands a room early without a closing read, so the check has
    // nothing to detect.
    const { closingRead } = variantOf(pack, practice.scope)
```

and change the close-check condition to:

```ts
      closingRead && session.closeDeliveredAt === undefined
        ? openai.chat.completions.create({
```

- [ ] **Step 3: Typecheck and push to dev**

Run: `npx tsc --noEmit -p . && npx convex dev --once`
Expected: clean.

- [ ] **Step 4: Stop for review**

Leave uncommitted.

---

### Task 9: The intake: choose beat, variant-aware form, next-step seeding

**Files:**
- Create: `src/components/simulation/intake/VariantChooser.tsx`
- Modify: `src/app/(flow)/simulation/new/page.tsx`
- Modify: `src/components/simulation/intake/TypedForm.tsx`
- Modify: `src/components/simulation/intake/ConfirmBrief.tsx`

**Interfaces:**
- Consumes: `variantOf`, `lockedPersona`, `PracticeVariant`, `ScopeField`, `Persona`.
- Produces: `missingRequired(fields: ScopeField[], scope: Scope): string[]`, `ctaLabel(panelist: Persona | null): string`, `ctaHint(panelist: Persona | null, prep: boolean): string`. `TypedForm` and `ConfirmBrief` take a `variant: PracticeVariant` prop.

- [ ] **Step 1: The chooser**

Create `src/components/simulation/intake/VariantChooser.tsx`:

```tsx
"use client"

import type { ScopeField } from "@/domains/types"

type VariantChooserProps = {
  field: ScopeField
  onChoose: (label: string) => void
}

// The first beat of a lane with kinds: one chips field, rendered as cards
// with room for a hint, because this answer reshapes everything after it.
export const VariantChooser = ({ field, onChoose }: VariantChooserProps) => (
  <div className="mx-auto max-w-[640px] pt-6 text-center">
    <h1 className="text-[25px] font-semibold tracking-[-.02em]">{field.label}</h1>
    <div role="group" aria-label={field.label} className="mt-8 grid gap-4 sm:grid-cols-2">
      {(field.options ?? []).map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChoose(option.label)}
          className="focus-ring rounded-2xl border border-line bg-surface-raised p-6 text-left shadow-card transition-colors hover:border-accent-line hover:bg-surface-2"
        >
          <span className="block text-[17px] font-semibold tracking-[-.01em]">{option.label}</span>
          {option.hint && (
            <span className="mt-1.5 block text-[13px] leading-normal text-on-surface-2">
              {option.hint}
            </span>
          )}
        </button>
      ))}
    </div>
  </div>
)
```

- [ ] **Step 2: `TypedForm` reads the variant**

In `src/components/simulation/intake/TypedForm.tsx`:

Imports: add `PracticeVariant`, `Persona`, `ScopeField` to the types import; keep `firstNameOf`.

Replace `ctaLabel`, `ctaHint`, and `missingRequired`:

```ts
export const ctaLabel = (panelist: Persona | null): string =>
  panelist ? `Meet ${firstNameOf(panelist.name)}` : "Choose your panel"

export const ctaHint = (panelist: Persona | null, prep: boolean): string => {
  if (!panelist) return "Three panelists. We'll recommend who to face first."
  const first = firstNameOf(panelist.name)
  return prep
    ? `${first} reads everything before the first question.`
    : `${first} knows nothing about you until you speak.`
}

export const missingRequired = (fields: ScopeField[], scope: Scope): string[] =>
  fields
    .filter((field) => {
      if (!field.required) return false
      const value = scope[field.key]
      return typeof value === "string" ? value.trim().length === 0 : !value
    })
    .map((field) => field.key)
```

Add `variant: PracticeVariant` to `TypedFormProps` (comment: `// The practice's shape for the current scope, resolved by the page.`) and destructure it. Inside the component:

```ts
  const panelist = lockedPersona(pack, variant)
  const fieldsByKey = new Map(variant.scopeFields.map((field) => [field.key, field]))
```

(import `lockedPersona` from `@/domains/registry`).

Wrap the materials `<section>` in `{variant.prep && ( ... )}`. Inside it, replace the reader line:

```tsx
                {panelist ? `${firstNameOf(panelist.name)} reads` : "Your panel reads"}{" "}
                everything before the session and fills in what it can below.
```

Replace `pack.copy.form.sections.map(` with `variant.copy.formSections.map(`. Inside the `ScopeFields` `fields` prop the `fieldsByKey` lookup already drops keys the variant does not carry.

`handleSubmit`: `const gaps = missingRequired(variant.scopeFields, form.scope)`.

CTA: `{submitting ? "Setting up" : ctaLabel(panelist)}` and `{ctaHint(panelist, variant.prep)}`.

The rail: change the grid so the column collapses without a preview, and render the rail only when there is one:

```tsx
    <div
      className={cn(
        "mx-auto grid min-h-0 w-full flex-1 items-start gap-x-14 max-lg:grid-cols-1",
        variant.copy.preview ? "max-w-[1060px] grid-cols-[minmax(0,1fr)_360px]" : "max-w-[640px] grid-cols-1"
      )}
    >
```

and

```tsx
      {variant.copy.preview && (
        <aside ref={railScroll} className="scrollbar-subtle hidden max-h-full min-h-0 space-y-4 overflow-y-auto overscroll-contain pb-8 lg:block">
          <div aria-hidden="true">
            <BriefPreview pack={pack} scope={previewScope} />
          </div>
          <EvidenceRail pack={pack} scope={previewScope} />
        </aside>
      )}
```

`BriefPreview` reads `pack.copy.preview`; the sales pack's is the pitch preview, and the rail is only rendered when the variant has one, so it stays correct.

- [ ] **Step 3: `ConfirmBrief` reads the variant**

In `src/components/simulation/intake/ConfirmBrief.tsx`:

Add `variant: PracticeVariant` to the props (import the type) and destructure. Replace the field derivations:

```ts
  const panelist = lockedPersona(pack, variant)
  // The chooser already answered the variant field; confirming it again
  // reads as a second question.
  const fields = variant.scopeFields.filter((field) => field.key !== pack.variantField)
  const textFields = fields.filter((field) => field.kind === "text" || field.kind === "textarea")
  const chipFields = fields.filter((field) => field.kind === "chips" || field.kind === "multi")
```

`handleSubmit`: `const gaps = missingRequired(variant.scopeFields, scope)`.

Replace the two `pack.personas.length > 1` copy sites:

```tsx
          {panelist
            ? `${firstNameOf(panelist.name)} reads these before the session:`
            : "Your panel reads these before the session:"}
```

```tsx
          {submitting
            ? "Setting up"
            : panelist
              ? `Looks right, meet ${firstNameOf(panelist.name)}`
              : "Looks right, choose your panel"}
```

and `{ctaHint(panelist, variant.prep)}`. Import `lockedPersona` from `@/domains/registry`.

- [ ] **Step 4: The page**

In `src/app/(flow)/simulation/new/page.tsx`:

Imports: add `variantOf` to the registry import, `scopeText` from `@/domains/types`, and `VariantChooser`.

Search params: `searchParams: Promise<{ lane?: string; from?: string; next?: string }>` and `const { lane, from, next } = use(searchParams)`.

Update the header comment:

```ts
// Voice-first intake for every lane. ?lane= wins over the user's default;
// ?from= prefills the typed form from an existing practice's scope (and
// pins its lane) so adjusting a brief never means retyping it; with
// &next=1 the prefill is the lane's suggested next practice instead.
```

Seeding effect:

```ts
  useEffect(() => {
    if (!source) return
    const suggested = next ? getPack(source.packId).nextStep?.(source.scope, source.lastVerdict ?? "") : null
    dispatchForms({
      lane: source.packId,
      action: { type: "seed", scope: suggested?.scope ?? source.scope },
    })
  }, [source, next])
```

After `const uploads = ...` and `dispatchForm`, derive the shape:

```ts
  const form = forms[pack.id] ?? initialFormState()
  const variant = variantOf(pack, form.scope)
  const variantField = pack.variantField
    ? variant.scopeFields.find((field) => field.key === pack.variantField)
    : undefined
  const needsChoice = variantField !== undefined && scopeText(form.scope, variantField.key) === ""
  // The chooser comes first for a lane with kinds; a lane without prep has
  // nothing to speak into, so "tell" reads as "type" there. Derived rather
  // than stored: a lane switch or a cleared choice re-routes on its own.
  const activeBeat: Beat = needsChoice
    ? { kind: "choose" }
    : beat.kind === "tell" && !variant.prep
      ? { kind: "type" }
      : beat
```

Add `| { kind: "choose" }` to the `Beat` union.

`handleTranscript`: merge the chosen kind into what was heard, since extraction never asks for it:

```ts
      const heard = await extractScope({ packId: pack.id, pitch: transcript, source: "voice" })
      const chosen = variantField ? { [variantField.key]: scopeText(form.scope, variantField.key) } : {}
      setBeat({ kind: "confirm", heard: { ...heard, ...chosen }, seconds })
```

`handleSubmit`: materials and routing follow prep:

```ts
      const practiceId = await createPractice({
        packId: pack.id,
        scope,
        materials: variant.prep ? uploads.readyMaterials : [],
      })
      if (variant.prep) {
        analyze({ id: practiceId }).catch(() => {
          // The wait screen owns retries; a failed kick-off just means it
          // starts the read itself.
        })
      }
      router.push(`/simulation/${practiceId}/${variant.prep ? "analyze" : "panel"}`)
```

Add the handlers:

```ts
  const handleChoose = (label: string) => {
    if (!variantField) return
    dispatchForm({ type: "change", key: variantField.key, value: label })
  }

  const handleChangeChoice = () => {
    if (!variantField) return
    dispatchForm({ type: "change", key: variantField.key, value: "" })
  }
```

`FlowShell`: `<FlowShell stage="brief" packId={pack.id} scope={form.scope} fullBleed>`.

Replace every `beat.kind ===` in the JSX with `activeBeat.kind ===` (the `confirm` branch reads `activeBeat.heard` and `activeBeat.seconds`). Add the choose beat before the tell beat:

```tsx
      {activeBeat.kind === "choose" && variantField && (
        <VariantChooser field={variantField} onChoose={handleChoose} />
      )}
```

In the `type` beat header, show the choice and let the user change it, and hide the "Talk it instead" button when the variant has no prep:

```tsx
          <div className="flex-none text-center">
            <h1 className="text-[25px] font-semibold tracking-[-.02em]">
              {pack.copy.tellIt.heading}
            </h1>
            {variantField && (
              <p className="mt-2 text-[12.5px] text-on-surface-3">
                {scopeText(form.scope, variantField.key)}
                <span aria-hidden="true"> · </span>
                <button type="button" onClick={handleChangeChoice} className="focus-ring rounded underline hover:text-accent-blue">
                  Change
                </button>
              </p>
            )}
            {variant.prep && (
              <button
                type="button"
                onClick={() => setBeat({ kind: "tell" })}
                className="focus-ring mb-6 mt-3 inline-flex items-center gap-2 rounded-full border border-line-2 bg-surface-raised px-3.5 py-[6px] text-[12.5px] text-on-surface-3 transition-colors hover:bg-surface-2 hover:text-accent-blue max-md:py-2.5"
              >
                <Mic className="size-[13px]" />
                Talk it instead. A minute is plenty
              </button>
            )}
          </div>
```

Give `mb-6` spacing to the `<p>` when the mic button is hidden by adding `className="mb-6 ..."` only in the no-prep case: simplest is to put `mb-6` on the wrapping `div` and drop it from the button (`mt-3 inline-flex ...`). Do that.

Pass `variant={variant}` and `form={form}` to `TypedForm`, and `variant={variant}` to `ConfirmBrief`.

The `handleLaneSwitch` comment and body stay; `activeBeat` re-derives the chooser for a lane with kinds.

- [ ] **Step 5: Typecheck, lint, tests**

Run: `npx tsc --noEmit -p . && pnpm lint && pnpm test`
Expected: clean. The `@typescript-eslint/no-unused-vars` rule will flag anything left over from the old `pack.scopeFields` paths; remove it.

- [ ] **Step 6: Manual check on dev**

Run `pnpm dev` and open `/simulation/new?lane=sales`. Expect: the chooser first; Cold call goes straight to a three-field form with no materials block and no rail; the rail in the header shows Brief, Panel, Room; Change returns to the chooser; Pitch meeting shows the tell-it beat, and typing shows the full form with materials. Founder lane: unchanged.

- [ ] **Step 7: Stop for review**

Leave uncommitted.

---

### Task 10: Stages and the panel

**Files:**
- Modify: `src/components/simulation/intake/AnalysisPipeline.tsx`
- Modify: `src/app/(flow)/simulation/[id]/audit/page.tsx`
- Modify: `src/components/simulation/intake/PanelSetup.tsx`

- [ ] **Step 1: The read stage sends a no-prep practice to the panel**

In `src/components/simulation/intake/AnalysisPipeline.tsx`, add `variantOf` to the registry import. Replace the `ready` derivation and its effect:

```ts
  const ready = practice?.status === "ready" && !!practice.context
  // A practice without prep never has a read; a typed URL lands here only
  // by accident, and the panel is where it belongs.
  const skipsPrep = practice ? !variantOf(getPack(practice.packId), practice.scope).prep : false

  // The findings live on the Audit stage — advance the moment the read
  // completes rather than making the user wait out the animation.
  useEffect(() => {
    if (skipsPrep) router.replace(`/simulation/${simulationId}/panel`)
    else if (ready) router.replace(`/simulation/${simulationId}/audit`)
  }, [ready, skipsPrep, router, simulationId])
```

- [ ] **Step 2: The prep page does the same**

In `src/app/(flow)/simulation/[id]/audit/page.tsx`:

```tsx
"use client"

import { use, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { getPack, variantOf } from "@/domains/registry"
import { FlowShell } from "@/components/simulation/flow/FlowShell"
import { AuditStage } from "@/components/simulation/intake/AuditStage"
import { BlueprintStage } from "@/components/simulation/intake/BlueprintStage"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"

// One route, two prep stages: the practice's pack declares whether its
// middle beat is the claims audit or the interview blueprint. A practice
// without prep has no middle beat and lands on the panel.
const PrepPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params)
  const router = useRouter()
  const practice = useQuery(api.practices.get, { id: id as Id<"practices"> })
  const pack = practice ? getPack(practice.packId) : null
  const skipsPrep = practice && pack ? !variantOf(pack, practice.scope).prep : false

  useEffect(() => {
    if (skipsPrep) router.replace(`/simulation/${id}/panel`)
  }, [skipsPrep, router, id])

  return (
    <FlowShell stage="audit" simulationId={id}>
      {practice === undefined || skipsPrep ? null : practice === null ? (
        <IdeaNotFound />
      ) : pack?.prep.kind === "blueprint" ? (
        <BlueprintStage simulationId={id} />
      ) : (
        <AuditStage simulationId={id} />
      )}
    </FlowShell>
  )
}

export default PrepPage
```

- [ ] **Step 3: The panel renders the locked persona**

In `src/components/simulation/intake/PanelSetup.tsx`:

Import `lockedPersona, variantOf` from the registry. After `const pack = getPack(practice.packId)`:

```ts
  const variant = variantOf(pack, practice.scope)
  const panelist = lockedPersona(pack, variant)
```

Change the context gate to `if (variant.prep && !practice.context) {`.

Replace `const trio = pack.personas.length > 1` and the lead paragraph:

```tsx
  const readLine = variant.prep
    ? `${panelist ? `${firstNameOf(panelist.name)} has` : "They've all"} read your brief${docChips.length > 0 ? " and your documents" : ""}. `
    : ""
```

```tsx
      <p className="mx-auto mb-9 mt-2.5 max-w-[54ch] text-sm leading-relaxed text-on-surface-2">
        {readLine}
        {variant.copy.panelLead}
      </p>
```

Replace `{trio ? (` with `{panelist === null ? (` for the grid branch and keep its body. In the single card branch, replace every `pack.personas[0]` with `panelist`, and wrap the receipt row so it only renders with prep:

```tsx
          {variant.prep && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface px-7 py-3.5 max-md:px-5">
              <span className="text-xs text-on-surface-3">
                {firstNameOf(panelist.name)}&apos;s read:
              </span>
              <ReceiptChip label="Your brief" />
              {docChips.map((name) => (
                <ReceiptChip key={name} label={name} />
              ))}
              {gapCount > 0 && <ReceiptChip label={`The gap map · ${gapCount} open`} />}
            </div>
          )}
```

Change the bottom `<span>` in that card from `{pack.copy.panel.lead}` to `{variant.copy.panelLead}`. Replace `{trio && (` for the footer with `{panelist === null && (` and its text "They've all read:" stays.

`recommended` is only used by the grid branch; move `const recommended = ...` inside a small guard so it is not computed for a locked panel:

```ts
  const recommended = panelist ? null : recommendPersona(pack, practice.scope, practice.personaId ?? null)
```

and in the grid branch use `recommended!` is not acceptable; instead compute inside the branch:

```tsx
      {panelist === null ? (
        <PersonaGrid ... />
```

Simplest that stays readable: keep `const recommended = recommendPersona(...)` as it is today (it is cheap and pure) and leave the grid untouched. Do that; do not add a guard.

- [ ] **Step 4: Typecheck, lint, manual check**

Run: `npx tsc --noEmit -p . && pnpm lint`
Then on dev: create a cold call; after submit the panel shows Greg's card with no receipt row and the cold lead; the rail reads Brief, Panel, Room; typing `/simulation/<id>/analyze` or `/audit` lands on the panel. Create a pitch meeting; the panel shows Cole locked with the receipt row.

- [ ] **Step 5: Stop for review**

Leave uncommitted.

---

### Task 11: The room

**Files:**
- Modify: `src/components/simulation/room/RoomShell.tsx`

- [ ] **Step 1: Budget-aware clock and copy**

Add `variantOf` to the registry import and `minutesPhrase` from `@/lib/ending`. Near `const pack = getPack(practice?.packId)` (line ~338) add:

```ts
  // Rooms from before the budget field ran the default; a practice that
  // vanished under a live session keeps the default shape.
  const roomMs = session.roomMs ?? ROOM_MS
  const closingRead = practice ? variantOf(pack, practice.scope).closingRead : true
```

Update the three clock reads:

- line ~334: `roomStartedAt && closingRead && shouldInvite(roomStartedAt, now, roomMs) && !isAvatarSpeaking`
- line ~604: `const reached = roomTimePhase(roomStartedAt, at, roomMs)`
- line ~605: `const atFloor = at - roomStartedAt >= roomMs - 2_000`

Add `roomMs` and `closingRead` to the dependency arrays of the effects that use them (the tick effect and any memo around the invitation).

Replace the connecting copy (line ~808):

```tsx
                    {`Sessions run ${minutesPhrase(roomMs / 60_000)}.${closingRead ? ` ${firstNameOf(persona.name)} will call time near the end.` : ""}`}
```

- [ ] **Step 2: Typecheck, lint, live check**

Run: `npx tsc --noEmit -p . && pnpm lint`
On dev, enter a cold-call room: the connecting screen says two minutes with no "call time" sentence; no invitation appears near the end; the room lands at two minutes. Enter a pitch room: unchanged.

- [ ] **Step 3: Stop for review**

Leave uncommitted.

---

### Task 12: The next step on the debrief page

**Files:**
- Modify: `src/app/(app)/p/[practiceId]/s/[sessionId]/page.tsx`

- [ ] **Step 1: Render the suggestion**

Add `getPack` to the registry import and `ArrowRight` to the lucide import. After `const debrief = session.debrief ?? null`:

```ts
  const nextStep = debrief ? getPack(practice.packId).nextStep?.(practice.scope, debrief.verdict) ?? null : null
```

In the CTA row after the "Go again" button:

```tsx
                {nextStep && (
                  <Link
                    href={`/simulation/new?from=${practiceId}&next=1`}
                    className={BTN_SECONDARY}
                  >
                    {nextStep.label}
                    <ArrowRight className="size-[14px]" />
                  </Link>
                )}
```

- [ ] **Step 2: Typecheck, lint, live check**

Run: `npx tsc --noEmit -p . && pnpm lint`
On dev, after a cold call debriefed as booked, the button appears and lands on the sales intake in the pitch shape with offering and prospect filled and the chooser skipped.

- [ ] **Step 3: Stop for review**

Leave uncommitted.

---

### Task 13: Full verification

- [ ] **Step 1: The whole suite**

Run: `pnpm test && npx tsc --noEmit -p . && pnpm lint && npx convex dev --once`
Expected: all green.

- [ ] **Step 2: End-to-end on dev**

1. Sales lane, Cold call: chooser, three fields, panel with Greg, two-minute room, Greg answers "Yeah, this is Greg." and knows nothing, no time promise, room lands on the clock, debrief with a cold outcome, "Prep the meeting with Cole" when booked.
2. Sales lane, Pitch meeting: chooser, tell-it, confirm, read, audit, panel with Cole locked, five-minute room with the ending contract, pitch debrief.
3. Founder and interview lanes: no chooser, unchanged rail and flow.
4. `?from=` on a pitch practice: chooser skipped, form prefilled.

- [ ] **Step 3: Hand off**

Leave everything uncommitted and list the changed files for the developer's review.

---

## Self-review

- **Spec coverage.** Contract and `variantOf` (Task 1). Sales rulebook, union verdicts, `sessionMetaField`, Cole's card (Task 2). Ending helpers with minutes (Task 3). Cold briefing with no-hang-up rules and one-line answer (Task 4). Cold orchestrate and debrief, verdict subset (Task 5). Rail without pre-read (Task 6). Create with variant validation and ready status, `roomMs`, time check, connect claim, debrief verdicts (Task 7). Mint contract and time promise gated, close check gated (Task 8). Choose beat, no tell-it or uploads without prep, active fields everywhere, `?next=1` (Task 9). Redirects and locked panel (Task 10). Room clock and copy (Task 11). Next-step link (Task 12).
- **Placeholders.** None. Two steps say "existing template, unchanged" where the prompt body is already in the file and the edit is only the branch at the top.
- **Type consistency.** `PracticeVariant.copy.{formSections, preview, panelLead}` is used by that name in Tasks 2, 9, 10. `withTimeContract(startScript, minutes)` in Tasks 3 and 8. `insertSessionForPersona(ctx, practice, pack, personaId)` in Task 7 for both callers. `missingRequired(fields, scope)` in Task 9 for both forms. `ctaHint(panelist, prep)` in both forms.

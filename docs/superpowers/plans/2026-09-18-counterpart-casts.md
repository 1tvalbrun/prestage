# Counterpart Casts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three faces per role, drawn once per practice on the server, so every new practice can meet a different counterpart and no practice ever changes face.

**Architecture:** Split each persona into an archetype (the role's behavior and card copy) and a persona (id, name, image). Practices store a `cast` map of drawn faces, written only by server mutations; session creation reads the face from the practice and never from the client. The counterpart stage and home render from the resolved counterpart, and a script pushes the role personalities to Runway.

**Tech Stack:** Next.js 16, TypeScript strict, Convex, `node:test`, Runway REST API.

**Spec:** `docs/superpowers/specs/2026-09-16-counterpart-casts-design.md`

## Global Constraints

- No semicolons. Const arrow functions. `Handle` prefix on event handlers. Early returns. Tailwind utilities only.
- Every public Convex function calls `requireIdentity`; single-doc reads go through `ownedOrNull`.
- The developer commits. Each task ends by stopping for review, never with `git commit`.
- Existing persona ids stay: `vc-01`, `tc-01`, `ta-01`, `buyer-01`, `prospect-01`, `assessor-01`, `screener-01`, `hm-01`, `practitioner-01`. New faces take `-02` and `-03` in the same series.
- Archetype ids stay as the code has them: `vc`, `target_customer`, `technical_architect`, `operator_buyer`, `cold_prospect`, `lead_assessor`, `recruiter_screen`, `hiring_manager`, `domain_practitioner`.
- "Panel" and "panelist" never appear in user-visible copy. The `/panel` route and `copy.panel` key are internal and stay.
- Tests run with `pnpm test` (node:test over `src/**/*.test.ts`). Typecheck with `npx tsc --noEmit -p .`. Lint with `pnpm lint`.
- One deviation from the spec, decided here for least code: there is no `practices.setArchetype`. A chooser lane's role choice is the first `sessions.create` call with an `archetypeId`; the server resolves the face from the cast and stores it. The spec's guarantee (no role or face change after the first session) holds because `sessions.create` refuses an `archetypeId` once `practice.personaId` is set.

---

### Task 1: Archetype and persona types, and the pure cast functions

**Files:**
- Modify: `src/domains/types.ts` (the `Persona` type block, `PracticeVariant.personaId`, `DomainPack.recommendPersona`, `DomainPack.personas`, `BriefingInput`)
- Create: `src/domains/cast.ts`
- Create: `src/domains/cast.test.ts`

**Interfaces:**
- Produces: `Archetype`, `Persona`, `Counterpart` types; `castOf(pack, archetypeId): Persona[]`; `resolveCounterpart(pack, personaId): Counterpart | null`; `laneFaces(pack, n): Persona[]`; `drawPersona(cast, lastFacedId, rng): Persona`; `drawCast(pack, lastFaced, rng): Record<string, string>`.
- `PracticeVariant.archetypeId: string | null` replaces `personaId`. `DomainPack.archetypes: Archetype[]` is added. `DomainPack.recommendArchetype?: (scope) => { archetypeId: string; reason: string } | null` replaces `recommendPersona`. `BriefingInput.counterpartFirstName: string` is added.

- [ ] **Step 1: Replace the persona types in `src/domains/types.ts`**

Find the block that starts with `// An interviewer identity.` and ends with the closing `}` of `export type Persona`. Replace it with:

```ts
// A role in a lane: everything about behavior and the copy that describes
// it. attack is the meet card's "what they come for" line; bio and tags
// feed persona cards; signature is the card's serif quote.
export type AttackSegment = { text: string; strong?: boolean }
export type Archetype = {
  id: string
  role: string
  shortRole: string
  tone: string
  attack: AttackSegment[]
  bio: string
  tags: string[]
  signature: string
}

// One face for an archetype. Only what differs between faces lives here;
// the spoken personality lives on the Runway Character.
export type Persona = {
  id: string
  archetypeId: string
  name: string
  image: string
}

// A persona resolved against its archetype: what every screen reads.
export type Counterpart = Persona & Omit<Archetype, "id">
```

In `PracticeVariant`, replace

```ts
  // The one persona this practice faces; null lets the panel offer a choice.
  personaId: string | null
```

with

```ts
  // The one archetype this practice faces; null lets the counterpart stage
  // offer a choice. The face comes from the practice's cast.
  archetypeId: string | null
```

In `DomainPack`, replace the `recommendPersona` comment and field with

```ts
  // Pack-supplied archetype recommendation for the chooser, consulted
  // before the generic focusAreas heuristic. Null means no opinion.
  recommendArchetype?: (scope: Scope) => { archetypeId: string; reason: string } | null
```

and replace `personas: Persona[]` with

```ts
  archetypes: Archetype[]
  personas: Persona[]
```

In `BriefingInput`, add after `continuity: Continuity | null`:

```ts
  // The face this session is with, for start scripts that say a name.
  counterpartFirstName: string
```

- [ ] **Step 2: Write the failing tests for the cast functions**

Create `src/domains/cast.test.ts`:

```ts
import test from "node:test"
import assert from "node:assert/strict"
import { castOf, drawCast, drawPersona, laneFaces, resolveCounterpart } from "./cast.ts"
import type { Archetype, DomainPack, Persona } from "./types.ts"

const archetype = (id: string): Archetype => ({
  id,
  role: `${id} role`,
  shortRole: `The ${id}`,
  tone: "",
  attack: [],
  bio: "",
  tags: [],
  signature: "",
})
const persona = (id: string, archetypeId: string): Persona => ({
  id,
  archetypeId,
  name: id,
  image: `/avatars/${id}.png`,
})

// Two roles with three faces and one role with a single face.
const pack = {
  archetypes: [archetype("a"), archetype("b"), archetype("c")],
  personas: [
    persona("a-01", "a"),
    persona("a-02", "a"),
    persona("a-03", "a"),
    persona("b-01", "b"),
    persona("b-02", "b"),
    persona("b-03", "b"),
    persona("c-01", "c"),
  ],
} as unknown as DomainPack

test("castOf lists the archetype's faces in pack order", () => {
  assert.deepEqual(
    castOf(pack, "a").map((p) => p.id),
    ["a-01", "a-02", "a-03"]
  )
  assert.deepEqual(castOf(pack, "missing"), [])
})

test("resolveCounterpart joins the face to its archetype and is null for unknown ids", () => {
  const c = resolveCounterpart(pack, "b-02")
  assert.equal(c?.name, "b-02")
  assert.equal(c?.shortRole, "The b")
  assert.equal(resolveCounterpart(pack, "nope"), null)
})

test("laneFaces represents every archetype before repeating any, in cast order", () => {
  assert.deepEqual(
    laneFaces(pack, 3).map((p) => p.id),
    ["a-01", "b-01", "c-01"]
  )
  assert.deepEqual(
    laneFaces(pack, 5).map((p) => p.id),
    ["a-01", "b-01", "c-01", "a-02", "b-02"]
  )
  assert.equal(laneFaces(pack, 20).length, 7)
})

test("drawPersona excludes the last faced and is uniform over the rest", () => {
  const cast = castOf(pack, "a")
  assert.equal(drawPersona(cast, "a-01", () => 0).id, "a-02")
  assert.equal(drawPersona(cast, "a-01", () => 0.99).id, "a-03")
  assert.equal(drawPersona(cast, null, () => 0.5).id, "a-02")
})

test("drawPersona falls back to the whole cast when there is one face", () => {
  assert.equal(drawPersona(castOf(pack, "c"), "c-01", () => 0.5).id, "c-01")
})

test("drawPersona throws on an empty cast", () => {
  assert.throws(() => drawPersona([], null, () => 0))
})

test("drawCast draws one face per archetype, avoiding each archetype's last face", () => {
  const cast = drawCast(pack, { a: "a-01", b: "b-03" }, () => 0)
  assert.deepEqual(cast, { a: "a-02", b: "b-01", c: "c-01" })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test src/domains/cast.test.ts`
Expected: FAIL, cannot find module `./cast.ts`.

- [ ] **Step 4: Create `src/domains/cast.ts`**

```ts
import type { Counterpart, DomainPack, Persona } from "./types.ts"

// Pure functions over a pack's archetypes and personas. No pack imports
// here, so the registry and Convex can both use them without a cycle.

export const castOf = (pack: DomainPack, archetypeId: string): Persona[] =>
  pack.personas.filter((persona) => persona.archetypeId === archetypeId)

export const resolveCounterpart = (pack: DomainPack, personaId: string): Counterpart | null => {
  const persona = pack.personas.find((p) => p.id === personaId)
  if (!persona) return null
  const archetype = pack.archetypes.find((a) => a.id === persona.archetypeId)
  if (!archetype) return null
  const { id: _archetypeId, ...behavior } = archetype
  return { ...persona, ...behavior }
}

// One face from every archetype first, then round-robin across them, up to
// n. The lane chooser's discs read this so no role is ever missing.
export const laneFaces = (pack: DomainPack, n: number): Persona[] => {
  const casts = pack.archetypes.map((archetype) => castOf(pack, archetype.id))
  const longest = Math.max(0, ...casts.map((cast) => cast.length))
  const faces: Persona[] = []
  for (let i = 0; i < longest; i += 1) {
    for (const cast of casts) {
      if (cast[i]) faces.push(cast[i])
    }
  }
  return faces.slice(0, n)
}

// Uniform over the cast minus the face met most recently. A single-face
// cast has nothing to avoid. rng is injected so tests are deterministic.
export const drawPersona = (
  cast: Persona[],
  lastFacedId: string | null,
  rng: () => number
): Persona => {
  if (cast.length === 0) throw new Error("Empty cast")
  const candidates = cast.length > 1 ? cast.filter((p) => p.id !== lastFacedId) : cast
  return candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))]
}

// A practice's cast: one drawn face per archetype in the pack.
export const drawCast = (
  pack: DomainPack,
  lastFaced: Record<string, string | undefined>,
  rng: () => number
): Record<string, string> =>
  Object.fromEntries(
    pack.archetypes.map((archetype) => [
      archetype.id,
      drawPersona(castOf(pack, archetype.id), lastFaced[archetype.id] ?? null, rng).id,
    ])
  )
```

- [ ] **Step 5: Run the cast tests**

Run: `node --test src/domains/cast.test.ts`
Expected: 7 pass. (The typecheck will fail until Task 3 rewrites the packs; that is expected at this point.)

- [ ] **Step 6: Stop for review.** Do not commit. Report: types changed, `cast.ts` and its tests added, typecheck red until the packs are split.

---

### Task 2: Registry, sales variant, interview recommendation, intake CTA

**Files:**
- Modify: `src/domains/registry.ts` (`variantOf`, `lockedPersona`)
- Modify: `src/domains/sales/variant.ts` (`salesVariant`, `coldPanelLead`, `pitchPreview`, `salesNextStep`)
- Modify: `src/domains/interview/pack.ts` (`TYPE_TO_PERSONA`, `recommendPersona`)
- Modify: `src/lib/intakeCta.ts`
- Modify: `src/domains/registry.test.ts`, `src/domains/sales/variant.test.ts`, `src/lib/intakeCta.test.ts`

**Interfaces:**
- Consumes: `Archetype`, `PracticeVariant.archetypeId` from Task 1.
- Produces: `lockedArchetype(pack, variant): Archetype | null`; `intakeCta(pack, variant, locked: Archetype | null)`.

- [ ] **Step 1: Update the registry tests**

In `src/domains/registry.test.ts`, change the import to `lockedArchetype`, and replace the interview recommendation test and the lock test:

```ts
test("the interview format drives the recommended archetype; unset reads as a full loop", () => {
  const recommend = PACKS.interview.recommendArchetype
  assert.ok(recommend)
  assert.equal(recommend({ interviewType: "Screening call" })?.archetypeId, "recruiter_screen")
  assert.equal(recommend({ interviewType: "Behavioral" })?.archetypeId, "hiring_manager")
  assert.equal(recommend({ interviewType: "Technical & scenarios" })?.archetypeId, "domain_practitioner")
  assert.equal(recommend({ interviewType: "Full loop (mixed)" })?.archetypeId, "hiring_manager")
  assert.equal(recommend({})?.archetypeId, "hiring_manager")
})

test("lockedArchetype is the single archetype of a one-role lane, else the variant's lock, else null", () => {
  assert.equal(lockedArchetype(PACKS.audit, variantOf(PACKS.audit, {}))?.id, "lead_assessor")
  assert.equal(lockedArchetype(PACKS.founder, variantOf(PACKS.founder, {})), null)
  const locked = { ...variantOf(PACKS.founder, {}), archetypeId: "target_customer" }
  assert.equal(lockedArchetype(PACKS.founder, locked)?.id, "target_customer")
})

test("every pack's personas and archetypes are consistent", () => {
  for (const pack of ALL_PACKS) {
    const archetypeIds = new Set(pack.archetypes.map((a) => a.id))
    for (const persona of pack.personas) {
      assert.ok(archetypeIds.has(persona.archetypeId), `${pack.id}: ${persona.id} has no archetype`)
    }
    for (const archetype of pack.archetypes) {
      assert.ok(
        pack.personas.some((p) => p.archetypeId === archetype.id),
        `${pack.id}: ${archetype.id} has no face`
      )
    }
    assert.equal(new Set(pack.personas.map((p) => p.id)).size, pack.personas.length, `${pack.id}: duplicate persona id`)
  }
})
```

Two existing tests assert the full persona id list per lane and must grow with the cast. In "the interview lane's cast and vocabulary match the spec", the expected list becomes:

```ts
    ["screener-01", "screener-02", "screener-03", "hm-01", "hm-02", "hm-03", "practitioner-01", "practitioner-02", "practitioner-03"]
```

and in "the sales lane's call types pick the buyer and the vocabulary":

```ts
    ["buyer-01", "buyer-02", "buyer-03", "prospect-01", "prospect-02", "prospect-03"]
```

Any remaining assertion that reads `variant.personaId` becomes `variant.archetypeId`.

In `src/domains/sales/variant.test.ts`, change `assert.equal(variant.personaId, "prospect-01")` to `assert.equal(variant.archetypeId, "cold_prospect")` and `assert.equal(variant.personaId, "buyer-01")` to `assert.equal(variant.archetypeId, "operator_buyer")`.

In `src/lib/intakeCta.test.ts`, change the imports and helper to:

```ts
import { ALL_PACKS, getPack, lockedArchetype, variantOf } from "../domains/registry.ts"
// ...
const ctaFor = (packId: string, scope: Scope = {}) => {
  const pack = getPack(packId)
  const variant = variantOf(pack, scope)
  return intakeCta(pack, variant, lockedArchetype(pack, variant))
}
```

The test "sales cold call: no prep, Greg is next" becomes "sales cold call: no prep, the counterpart is next" and asserts `cta.label` equals `"Meet your counterpart"`. The `confirmLabel` test's fixture string can stay as it is; it tests casing, not copy. The `doesNotMatch(cta.label, /^Meet |Choose your counterpart/)` assertion stays.

- [ ] **Step 2: Run the three test files to verify they fail**

Run: `node --test src/domains/registry.test.ts src/domains/sales/variant.test.ts src/lib/intakeCta.test.ts`
Expected: FAIL on `lockedArchetype` not exported and `recommendArchetype` undefined.

- [ ] **Step 3: Update `src/domains/registry.ts`**

Replace the `Persona` import with `Archetype`, set `archetypeId: null` in `variantOf`'s default, and replace `lockedPersona` with:

```ts
// The one archetype a practice can face, when there is exactly one: the
// variant locks it, or the lane has a single role.
export const lockedArchetype = (pack: DomainPack, variant: PracticeVariant): Archetype | null =>
  pack.archetypes.find((archetype) => archetype.id === variant.archetypeId) ??
  (pack.archetypes.length === 1 ? pack.archetypes[0] : null)
```

- [ ] **Step 4: Update `src/domains/sales/variant.ts`**

In `salesVariant`, change `personaId: "prospect-01"` to `archetypeId: "cold_prospect"` and `personaId: "buyer-01"` to `archetypeId: "operator_buyer"`.

The preview renders before a practice exists, so it names the role, not a face:

```ts
export const pitchPreview: PackCopy["preview"] = {
  title: "What the buyer will read",
  rows: [
    { key: "offering", label: "Selling", hint: "Not yet named" },
    { key: "description", label: "What it does", hint: "The problem it removes, in the buyer's terms" },
    { key: "prospect", label: "Across the table", hint: "Who the buyer is playing" },
  ],
  chips: { label: "Ask and objections", keys: ["ask", "objections"] },
  footer: "Only what you put here makes it in; gaps become questions, not guesses.",
}
```

```ts
const coldPanelLead =
  "They don't know you're calling and haven't read a thing. They pick up, you talk, and they decide whether you get thirty seconds more."
```

and in `salesNextStep`, `label: "Prep the meeting with Cole"` becomes `label: "Prep the meeting"`.

- [ ] **Step 5: Update `src/domains/interview/pack.ts`**

```ts
const TYPE_TO_ARCHETYPE: Record<string, { archetypeId: string; reason: string }> = {
  "Screening call": { archetypeId: "recruiter_screen", reason: "Built for the screen" },
  Behavioral: { archetypeId: "hiring_manager", reason: "Built for behavioral loops" },
  "Technical & scenarios": { archetypeId: "domain_practitioner", reason: "Built for the deep-dive" },
  "Full loop (mixed)": { archetypeId: "hiring_manager", reason: "Anchors a full loop" },
}
```

and

```ts
  recommendArchetype: (scope: Scope) =>
    TYPE_TO_ARCHETYPE[scopeText(scope, "interviewType")] ?? TYPE_TO_ARCHETYPE["Full loop (mixed)"],
```

- [ ] **Step 6: Update `src/lib/intakeCta.ts`**

```ts
import type { Archetype, DomainPack, PracticeVariant } from "../domains/types.ts"

export type IntakeCta = { label: string; hint: string }

// The brief's submit button names the beat it starts. With prep that beat
// is the read, and meeting anyone comes two steps later, so the pack's
// copy speaks; without prep the counterpart step is next. The face is not
// drawn until the practice exists, so the button names the role, not a name.
export const intakeCta = (
  pack: DomainPack,
  variant: PracticeVariant,
  locked: Archetype | null
): IntakeCta => {
  if (variant.prep) return pack.prep.start
  if (!locked) return { label: "Choose your counterpart", hint: "You pick who to face next." }
  return { label: "Meet your counterpart", hint: "They know nothing about you until you speak." }
}
```

Keep `confirmLabel` as it is.

- [ ] **Step 7: Run the three test files**

Run: `node --test src/domains/registry.test.ts src/domains/sales/variant.test.ts src/lib/intakeCta.test.ts`
Expected: the registry consistency test and lock test fail only because packs still lack `archetypes` (Task 3). The variant and intakeCta tests pass. Note which fail and why in the report.

- [ ] **Step 8: Stop for review.** Do not commit.

---

### Task 3: Split every lane into archetypes and casts; dynamic first name in the cold-call opener

**Files:**
- Rewrite: `src/domains/founder/personas.ts`, `src/domains/sales/personas.ts`, `src/domains/audit/personas.ts`, `src/domains/interview/personas.ts`
- Modify: `src/domains/founder/pack.ts`, `src/domains/sales/pack.ts`, `src/domains/audit/pack.ts`, `src/domains/interview/pack.ts` (the `personas:` line gains `archetypes:`)
- Modify: `src/domains/audit/pack.ts` (`preview.title`)
- Modify: `src/domains/sales/briefing.ts` (`buildColdCallBriefing` start script)
- Modify: `src/domains/sales/briefing.test.ts` and any other briefing test that builds a `BriefingInput`

**Interfaces:**
- Consumes: `Archetype`, `Persona` from Task 1.
- Produces: per lane, `FOUNDER_ARCHETYPES` / `FOUNDER_CAST`, `SALES_ARCHETYPES` / `SALES_CAST`, `AUDIT_ARCHETYPES` / `AUDIT_CAST`, `INTERVIEW_ARCHETYPES` / `INTERVIEW_CAST`.

- [ ] **Step 1: Rewrite `src/domains/founder/personas.ts`**

Move every behavior field of the three existing personas into an archetype with the same `archetypeId`, and list the faces. The text is unchanged; only its home moves.

```ts
import type { Archetype, Persona } from "../types.ts"

// The founder lane's roles and casts. Behavior lives on the archetype; the
// face carries only name and photo. Runway avatar ids live in the Convex
// avatars registry, keyed by persona id.
export const FOUNDER_ARCHETYPES: Archetype[] = [
  {
    id: "vc",
    role: "Partner, Series A/B · Enterprise SaaS",
    shortRole: "The VC",
    tone: "Sharp, economical with words, uses silence as pressure",
    attack: [
      { text: "Will open on " },
      { text: "market size and pricing power", strong: true },
      { text: ": your TAM and why anyone pays." },
    ],
    bio: "Reviewed 2,000+ pitches, backed 23, watched 11 fail. Comes for market size, moats, pricing power and round math.",
    tags: ["Market sizing", "Defensibility", "Pricing power"],
    signature: "Walk me through the market math, bottoms-up, not the report you bought.",
  },
  {
    id: "target_customer",
    role: "Head of Strategy, Series C SaaS ($80M ARR)",
    shortRole: "The buyer",
    tone: "Blunt, buyer-brained, has been burned by overpromised tools before",
    attack: [
      { text: "Plays your real customer. Comes for " },
      { text: "switching cost and procurement", strong: true },
      { text: ": why they'd rip out what they already have." },
    ],
    bio: "Plays your real customer. Asks what it replaces, what switching costs, and what happens when it breaks at 11pm.",
    tags: ["Buying process", "Switching cost", "Procurement"],
    signature: "Why would I rip out something that already works for this?",
  },
  {
    id: "technical_architect",
    role: "Principal Engineer, ML Infrastructure",
    shortRole: "The architect",
    tone: "Methodical, surfaces assumptions others don't see, constructive not combative",
    attack: [
      { text: "Thinks in failure modes. Goes straight at " },
      { text: "feasibility and reliability", strong: true },
      { text: ": accuracy claims, latency, and what breaks first." },
    ],
    bio: 'Thinks in failure modes. Flags accuracy claims with no methodology and "optimize later" in the critical path.',
    tags: ["Latency", "Reliability", "Build vs buy"],
    signature: "You said it's accurate. Show me how you measured that.",
  },
]

export const FOUNDER_CAST: Persona[] = [
  { id: "vc-01", archetypeId: "vc", name: "Victoria Chen", image: "/avatars/victoria-chen.png" },
  { id: "vc-02", archetypeId: "vc", name: "Andrew Caldwell", image: "/avatars/andrew-caldwell.png" },
  { id: "vc-03", archetypeId: "vc", name: "Daniel Osei", image: "/avatars/daniel-osei.png" },
  { id: "tc-01", archetypeId: "target_customer", name: "Marcus Rivera", image: "/avatars/marcus-rivera.png" },
  { id: "tc-02", archetypeId: "target_customer", name: "Megan Sullivan", image: "/avatars/megan-sullivan.png" },
  { id: "tc-03", archetypeId: "target_customer", name: "Angela Whitfield", image: "/avatars/angela-whitfield.png" },
  { id: "ta-01", archetypeId: "technical_architect", name: "Dr. Sarah Okafor", image: "/avatars/sarah-okafor.png" },
  { id: "ta-02", archetypeId: "technical_architect", name: "Erik Larsen", image: "/avatars/erik-larsen.png" },
  { id: "ta-03", archetypeId: "technical_architect", name: "Arjun Mehta", image: "/avatars/arjun-mehta.png" },
]
```

Note the one copy change: the target customer's attack line said "why he'd rip out"; with three faces it says "why they'd rip out."

- [ ] **Step 2: Rewrite `src/domains/sales/personas.ts`**

```ts
import type { Archetype, Persona } from "../types.ts"

// The sales lane's two roles, one per call type. A pitch meeting is a
// 1-on-1 with the operator who owns the process you're asking them to
// change; a cold call is a 1-on-1 with someone who never asked to hear
// from you.
export const SALES_ARCHETYPES: Archetype[] = [
  {
    id: "operator_buyer",
    role: "Owns the process you're asking them to change",
    shortRole: "The buyer",
    tone: "Warm but immovable, guards the team's time, has sat through a hundred vendor pitches",
    attack: [
      { text: "Owns the process you want to change. Comes for " },
      { text: "switching cost and proof", strong: true },
      { text: ": what breaks, who pays, and what happens at month three." },
    ],
    bio: "Plays whoever you're pitching, from the inside of that operation. Has bought a dozen tools that worked and ripped out three that didn't. Likes ideas fine; buys outcomes, references, and a next step worth the calendar slot.",
    tags: ["Switching cost", "ROI proof", "Next steps"],
    signature: "I've sat through a hundred vendor pitches. Show me the one thing that makes yours worth a next step.",
  },
  {
    id: "cold_prospect",
    role: "Owner-operator, small local business",
    shortRole: "The cold call",
    tone: "Busy, polite, distracted at first, spots a sales call in the first breath",
    attack: [
      { text: "Never asked to hear from you. Comes for " },
      { text: "why you're calling and why now", strong: true },
      { text: ": you get thirty seconds, then they decide." },
    ],
    bio: "Picked up because it might have been a customer. Knows nothing about you or what you sell, has a hundred unexpected calls behind them, and gives every one a fair thirty seconds.",
    tags: ["The opener", "Brush-offs", "The small ask"],
    signature: "Yeah, what's this about?",
  },
]

export const SALES_CAST: Persona[] = [
  { id: "buyer-01", archetypeId: "operator_buyer", name: "Cole Merritt", image: "/avatars/cole-merritt.png" },
  { id: "buyer-02", archetypeId: "operator_buyer", name: "Denise Jackson", image: "/avatars/denise-jackson.png" },
  { id: "buyer-03", archetypeId: "operator_buyer", name: "Omar Nasser", image: "/avatars/omar-nasser.png" },
  { id: "prospect-01", archetypeId: "cold_prospect", name: "Greg Hollis", image: "/avatars/greg-hollis.png" },
  { id: "prospect-02", archetypeId: "cold_prospect", name: "Luis Ortega", image: "/avatars/luis-ortega.png" },
  { id: "prospect-03", archetypeId: "cold_prospect", name: "Tammy Nguyen", image: "/avatars/tammy-nguyen.png" },
]
```

Copy changes: the prospect's attack line and bio say "they" instead of "he"; the signature drops the name ("Yeah, this is Greg. What's this about?" becomes "Yeah, what's this about?").

- [ ] **Step 3: Rewrite `src/domains/audit/personas.ts`**

```ts
import type { Archetype, Persona } from "../types.ts"

// The audit lane's one role. An audit interview is a 1-on-1 session.
export const AUDIT_ARCHETYPES: Archetype[] = [
  {
    id: "lead_assessor",
    role: "Lead Security Assessor, 25 years across finance and SaaS",
    shortRole: "The assessor",
    tone: "Methodical and unhurried, kind but impossible to rush past, asks to see rather than hear",
    attack: [
      { text: "Runs it like the real thing. Comes for " },
      { text: "evidence and cadence", strong: true },
      { text: ": show the record, and show the last time it ran." },
    ],
    bio: 'Twenty-five years of audit interviews across finance and SaaS. Believes every control has a paper trail or it didn’t happen; warm until an answer begins with "usually".',
    tags: ["Evidence trails", "Show don't tell", "Cadence"],
    signature: "If ransomware took your production environment tonight, explain to me why it can't touch this copy.",
  },
]

export const AUDIT_CAST: Persona[] = [
  { id: "assessor-01", archetypeId: "lead_assessor", name: "Priya Nair", image: "/avatars/priya-nair.png" },
  { id: "assessor-02", archetypeId: "lead_assessor", name: "Mark Sorensen", image: "/avatars/mark-sorensen.png" },
  { id: "assessor-03", archetypeId: "lead_assessor", name: "Malcolm Pierce", image: "/avatars/malcolm-pierce.png" },
]
```

- [ ] **Step 4: Rewrite `src/domains/interview/personas.ts`**

```ts
import type { Archetype, Persona } from "../types.ts"

// The interview lane's three roles, specialized by interview format, not
// domain. Formats are few and stable; domains are infinite.
export const INTERVIEW_ARCHETYPES: Archetype[] = [
  {
    id: "recruiter_screen",
    role: "Recruiter, first-round screen",
    shortRole: "The screener",
    tone: "Fast, warm, efficient; listens for motivation, a coherent career story, and the fit questions a resume can't answer",
    attack: [
      { text: "Runs the thirty-minute screen. Comes for " },
      { text: "your story and your why", strong: true },
      { text: ": what you did, why you're leaving, and whether it holds together at pace." },
    ],
    bio: "Screens hundreds of candidates a year and decides in minutes who moves forward. Friendly on the surface, ruthless about vagueness — a rambling answer is its own red flag.",
    tags: ["Motivation", "Career story", "Fit"],
    signature:
      "Walk me through the last few years in about a minute — and what you're looking for next.",
  },
  {
    id: "hiring_manager",
    role: "Hiring manager, behavioral loop",
    shortRole: "The hiring manager",
    tone: "Steady and probing, goes three levels deep on every story; allergic to a 'we' that hides what you actually did",
    attack: [
      { text: "Owns the team you'd join. Comes for " },
      { text: "ownership and conflict", strong: true },
      { text: ": real stories, your actual role in them, and what you'd do differently." },
    ],
    bio: "Has hired and managed through enough cycles to know rehearsed answers on sight. Asks for one story, then follows it down until the real decisions and the real mistakes show.",
    tags: ["Ownership", "Conflict", "Behavioral depth"],
    signature: "Tell me about a time this went wrong — and what you did about it.",
  },
  {
    id: "domain_practitioner",
    role: "Senior practitioner, domain deep-dive",
    shortRole: "The practitioner",
    tone: "Knowledgeable and scenario-driven; presses why-chains and trade-offs until the reasoning either holds or runs out",
    attack: [
      { text: "Does the job you're interviewing for. Comes for " },
      { text: "scenarios and trade-offs", strong: true },
      { text: ": concrete situations, your reasoning under pressure, and the why behind each call." },
    ],
    bio: "The interviewer who's done the work. Doesn't quiz on trivia — puts you in a situation from the role and keeps asking why until it's clear whether you've actually been there.",
    tags: ["Technical depth", "Trade-offs", "Scenarios"],
    signature: "Let's get concrete. Walk me through exactly how you'd handle this one.",
  },
]

export const INTERVIEW_CAST: Persona[] = [
  { id: "screener-01", archetypeId: "recruiter_screen", name: "Jun Park", image: "/avatars/jun-park.png" },
  { id: "screener-02", archetypeId: "recruiter_screen", name: "Emily Hartman", image: "/avatars/emily-hartman.png" },
  { id: "screener-03", archetypeId: "recruiter_screen", name: "Camila Duarte", image: "/avatars/camila-duarte.png" },
  { id: "hm-01", archetypeId: "hiring_manager", name: "Renee Calloway", image: "/avatars/renee-calloway.png" },
  { id: "hm-02", archetypeId: "hiring_manager", name: "Tom Hendricks", image: "/avatars/tom-hendricks.png" },
  { id: "hm-03", archetypeId: "hiring_manager", name: "Valeria Castillo", image: "/avatars/valeria-castillo.png" },
  { id: "practitioner-01", archetypeId: "domain_practitioner", name: "Tomás Reyes", image: "/avatars/tomas-reyes.png" },
  { id: "practitioner-02", archetypeId: "domain_practitioner", name: "Ryan Mitchell", image: "/avatars/ryan-mitchell.png" },
  { id: "practitioner-03", archetypeId: "domain_practitioner", name: "Anjali Desai", image: "/avatars/anjali-desai.png" },
]
```

- [ ] **Step 5: Point each pack at its archetypes and cast**

In each `pack.ts`, replace the import of the old constant (`PANEL_PERSONAS`, `BUYER_PERSONAS`, `ASSESSOR_PERSONAS`, `INTERVIEWER_PERSONAS`) with the two new ones, and replace the `personas:` line with two lines, e.g. for founder:

```ts
  archetypes: FOUNDER_ARCHETYPES,
  personas: FOUNDER_CAST,
```

In `src/domains/audit/pack.ts`, change `title: "What Priya will read"` to `title: "What the assessor will read"`.

- [ ] **Step 6: Make the cold-call opener say the drawn face's name**

In `src/domains/sales/briefing.ts`, `buildColdCallBriefing` destructures `{ scope, transcript }`. Add `counterpartFirstName` and change the fresh-call return's start script:

```ts
const buildColdCallBriefing = ({ scope, transcript, counterpartFirstName }: BriefingInput): RoomBriefing => {
```

```ts
    startScript: `Yeah, this is ${counterpartFirstName}.`,
```

All four `src/domains/*/briefing.test.ts` files construct `BriefingInput` objects; each gets `counterpartFirstName: "Greg"` (any name works for the lanes that ignore it). Then add one test to `src/domains/sales/briefing.test.ts` so the opener is covered:

```ts
test("a fresh cold call opens with the drawn face's name", () => {
  const briefing = salesPack.briefing({
    scope: { [CALL_TYPE_KEY]: COLD_CALL, prospect: "the owner of a dental office" },
    audit: null,
    continuity: null,
    transcript: [],
    counterpartFirstName: "Tammy",
  })
  assert.equal(briefing.startScript, "Yeah, this is Tammy.")
})
```

Use whatever imports that file already has for the pack and the call-type constants.

- [ ] **Step 7: Run tests and the typecheck**

Run: `pnpm test` then `npx tsc --noEmit -p .`
Expected: tests pass except any that reference `pack.personas[n].role` or `lockedPersona` in files not yet updated (Tasks 4 and 5 fix the app code). The typecheck reports errors only in `convex/practices.ts`, `convex/sessions.ts`, `convex/avatars.ts`, `src/app/(app)/page.tsx`, `src/app/(app)/p/[practiceId]/page.tsx`, `src/app/api/export/route.ts`, `src/components/simulation/intake/PanelSetup.tsx`, `src/components/simulation/intake/TypedForm.tsx`, `src/components/simulation/intake/ConfirmBrief.tsx`. List them in the report.

- [ ] **Step 8: Stop for review.** Do not commit.

---

### Task 4: Schema and mutations: the cast on practices, the draw, face-again, and session create without a client persona id

**Files:**
- Modify: `convex/schema.ts` (practices table)
- Modify: `convex/practices.ts` (`create`, `setPersona` removed, `ensureCast`, `faceAgain`, `metFaces` added)
- Modify: `convex/sessions.ts` (`insertSessionForPersona`, `create`)
- Modify: `convex/avatars.ts` (`mint` passes the first name to the briefing)

**Interfaces:**
- Consumes: `drawCast`, `resolveCounterpart`, `castOf` from Task 1; `lockedArchetype`, `variantOf` from Task 2.
- Produces: `practices.ensureCast({ id })`, `practices.faceAgain({ id, personaId })`, `practices.metFaces({ packId }): string[]`, `sessions.create({ practiceId, archetypeId?, micCheck? })`.

- [ ] **Step 1: Add `cast` to the practices table in `convex/schema.ts`**

After the `personaId` field:

```ts
    // The face drawn for each archetype in the pack, keyed by archetype id.
    // Drawn once by the server when the practice is created; never set from
    // a client-supplied persona id. Optional: rows from before casts get one
    // lazily (practices.ensureCast).
    cast: v.optional(v.record(v.string(), v.string())),
```

- [ ] **Step 2: Add the draw helpers and the new mutations to `convex/practices.ts`**

Add imports:

```ts
import { castOf, drawCast, resolveCounterpart } from "../src/domains/cast"
import { lockedArchetype } from "../src/domains/registry"
import type { DomainPack } from "../src/domains/types"
```

Add, above `create`:

```ts
// The face the user met most recently in each of this pack's archetypes,
// read from their own practices (the by_user prefix covers archived rows
// too). A practice with no sessions has not been "met".
const lastFacedByArchetype = async (
  ctx: MutationCtx,
  userId: string,
  pack: DomainPack
): Promise<Record<string, string>> => {
  const practices = await ctx.db
    .query("practices")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()
  const latest: Record<string, { personaId: string; at: number }> = {}
  for (const practice of practices) {
    if (practice.packId !== pack.id || !practice.personaId || !practice.lastSessionAt) continue
    const counterpart = resolveCounterpart(pack, practice.personaId)
    if (!counterpart) continue
    const current = latest[counterpart.archetypeId]
    if (!current || practice.lastSessionAt > current.at) {
      latest[counterpart.archetypeId] = { personaId: practice.personaId, at: practice.lastSessionAt }
    }
  }
  return Object.fromEntries(Object.entries(latest).map(([id, { personaId }]) => [id, personaId]))
}

// A fresh cast for a practice, seeded from a face it already holds so an
// existing practice never changes who it is with.
const castFor = async (
  ctx: MutationCtx,
  userId: string,
  pack: DomainPack,
  existingPersonaId: string | undefined
): Promise<Record<string, string>> => {
  const cast = drawCast(pack, await lastFacedByArchetype(ctx, userId, pack), Math.random)
  const existing = existingPersonaId ? resolveCounterpart(pack, existingPersonaId) : null
  if (existing) cast[existing.archetypeId] = existing.id
  return cast
}
```

`MutationCtx` comes from `./_generated/server`; add it to the existing import if it is not already there.

In `create`, replace the insert with:

```ts
    const cast = await castFor(ctx, identity.subject, pack, undefined)
    const locked = lockedArchetype(pack, variant)
    const practiceId = await ctx.db.insert("practices", {
      userId: identity.subject,
      name,
      packId: pack.id,
      status: variant.prep ? "draft" : "ready",
      scope,
      cast,
      ...(locked ? { personaId: cast[locked.id] } : {}),
    })
```

Delete the `setPersona` mutation entirely. Add in its place:

```ts
// Practices from before casts get one on first visit to the counterpart
// stage. A practice that already has a cast is a no-op, so a re-render
// never redraws.
export const ensureCast = mutation({
  args: { id: v.id("practices") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const practice = ownedOrNull(identity, await ctx.db.get(args.id))
    if (!practice) throw new Error("Practice not found")
    if (practice.cast) return
    const pack = getPack(practice.packId)
    const cast = await castFor(ctx, identity.subject, pack, practice.personaId)
    const locked = lockedArchetype(pack, variantOf(pack, practice.scope))
    await ctx.db.patch(args.id, {
      cast,
      ...(locked && !practice.personaId ? { personaId: cast[locked.id] } : {}),
    })
  },
})

// The persona ids this user has actually met in a pack: any of their
// practices with that face and at least one session.
export const metFaces = query({
  args: { packId: v.string() },
  handler: async (ctx, args): Promise<string[]> => {
    const identity = await requireIdentity(ctx)
    const practices = await ctx.db
      .query("practices")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect()
    const met = new Set<string>()
    for (const practice of practices) {
      if (practice.packId === args.packId && practice.personaId && (practice.sessionCount ?? 0) > 0) {
        met.add(practice.personaId)
      }
    }
    return [...met]
  },
})

// "Face them again": the only client path that names a persona id, and it
// can only name a face this user has already met in that archetype, on a
// practice with no sessions yet.
export const faceAgain = mutation({
  args: { id: v.id("practices"), personaId: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const practice = ownedOrNull(identity, await ctx.db.get(args.id))
    if (!practice) throw new Error("Practice not found")
    if ((practice.sessionCount ?? 0) > 0) throw new Error("This practice already has sessions")
    const pack = getPack(practice.packId)
    const counterpart = resolveCounterpart(pack, args.personaId)
    if (!counterpart) throw new Error("Unknown persona")
    const history = await ctx.db
      .query("practices")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect()
    const hasMet = history.some(
      (p) => p.packId === pack.id && p.personaId === args.personaId && (p.sessionCount ?? 0) > 0
    )
    if (!hasMet) throw new Error("Not a face you have met")
    const cast = practice.cast ?? (await castFor(ctx, identity.subject, pack, practice.personaId))
    cast[counterpart.archetypeId] = counterpart.id
    // The practice's own face follows the swap only when it is that archetype.
    const current = practice.personaId ? resolveCounterpart(pack, practice.personaId) : null
    const locked = lockedArchetype(pack, variantOf(pack, practice.scope))
    const followsPersona =
      current?.archetypeId === counterpart.archetypeId || locked?.id === counterpart.archetypeId
    await ctx.db.patch(args.id, {
      cast,
      ...(followsPersona ? { personaId: counterpart.id } : {}),
    })
  },
})
```

- [ ] **Step 3: Rewrite session creation in `convex/sessions.ts`**

Change the imports to bring in the resolver:

```ts
import { resolveCounterpart } from "../src/domains/cast"
```

In `insertSessionForPersona`, replace

```ts
  const persona = pack.personas.find((p) => p.id === personaId)
  if (!persona) throw new Error("Unknown persona")
```

with

```ts
  const persona = resolveCounterpart(pack, personaId)
  if (!persona) throw new Error("Unknown persona")
```

The stored `persona` object already reads `id`, `archetypeId`, `name`, `role`, `tone` from it; those fields exist on a `Counterpart`.

Replace the `create` mutation:

```ts
export const create = mutation({
  args: {
    practiceId: v.id("practices"),
    // A chooser lane's first session names the role; the server picks the
    // face from the practice's cast. Ignored once the practice has a face.
    archetypeId: v.optional(v.string()),
    micCheck: v.optional(micCheckValidator),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const practice = ownedOrNull(identity, await ctx.db.get(args.practiceId))
    if (!practice) throw new Error("Practice not found")
    // A still-live session is the one to return to — rejoin it rather than
    // minting a parallel one (and a second billable avatar session).
    const live = await ctx.db
      .query("sessions")
      .withIndex("by_practice_status", (q) =>
        q.eq("practiceId", args.practiceId).eq("status", "live")
      )
      .first()
    if (live) return live._id
    const personaId = practice.personaId ?? (args.archetypeId ? practice.cast?.[args.archetypeId] : undefined)
    if (!personaId) throw new Error("No counterpart for this practice")
    const micCheck =
      args.micCheck && isMeasuredLevel(args.micCheck.noiseDb) && isMeasuredLevel(args.micCheck.voiceDb)
        ? args.micCheck
        : undefined
    const sessionId = await insertSessionForPersona(
      ctx,
      practice,
      getPack(practice.packId),
      personaId,
      micCheck
    )
    // The first session fixes the practice's face for life.
    if (!practice.personaId) await ctx.db.patch(args.practiceId, { personaId })
    return sessionId
  },
})
```

- [ ] **Step 4: Pass the first name into the briefing in `convex/avatars.ts`**

In `mint`, the `pack.briefing({...})` call gains one line:

```ts
      counterpartFirstName: firstNameOf(session.persona.name),
```

`firstNameOf` is already imported there.

- [ ] **Step 5: Typecheck the backend**

Run: `npx tsc --noEmit -p .`
Expected: no errors in `convex/`. Errors remain in the app files listed in Task 3 step 7.

- [ ] **Step 6: Stop for review.** Do not commit. The hand checks against the dev deployment happen after Task 6, when the stage can drive them.

---

### Task 5: Move the persona consumers to the resolver; portrait discs; three-face lane cards

**Files:**
- Modify: `src/components/shared/PersonaAvatar.tsx` (optional `image` prop)
- Modify: `src/app/(app)/page.tsx` (`personaFor`, `FirstRun` discs, avatars with images)
- Modify: `src/app/(app)/p/[practiceId]/page.tsx` (persona lookup, avatar image)
- Modify: `src/app/api/export/route.ts` (persona name)
- Modify: `src/components/simulation/intake/TypedForm.tsx`, `src/components/simulation/intake/ConfirmBrief.tsx` (`lockedPersona` → `lockedArchetype`)

**Interfaces:**
- Consumes: `resolveCounterpart`, `laneFaces` from Task 1; `lockedArchetype` from Task 2.

- [ ] **Step 1: Give `PersonaAvatar` a portrait**

In `src/components/shared/PersonaAvatar.tsx`, add `import Image from "next/image"`, an optional `image?: string` prop, and render it inside the disc when present:

```tsx
export const PersonaAvatar = ({
  name,
  image,
  size = "md",
  available,
  className,
}: {
  name: string
  image?: string
  size?: keyof typeof SIZES
  available?: boolean
  className?: string
}) => (
  <span
    aria-label={available ? `${name}, available` : name}
    className={cn(
      "relative grid flex-none place-items-center overflow-hidden rounded-full border border-line-2 bg-surface-2 font-semibold text-on-surface-2",
      SIZES[size],
      className
    )}
  >
    {image ? (
      <Image src={image} alt="" fill sizes="64px" className="object-cover object-top" />
    ) : (
      personaInitials(name)
    )}
    {available && (
      <span
        aria-hidden="true"
        className="absolute -right-px bottom-0 h-[11px] w-[11px] rounded-full border-[2.5px] border-surface bg-ok"
      />
    )}
  </span>
)
```

Update the file's leading comment to: `// A round portrait, or a neutral initials disc when there is no photo. Deliberately colorless: lanes carry no identity color.`

- [ ] **Step 2: Home page**

In `src/app/(app)/page.tsx`, replace the `personaFor` helper:

```ts
const personaFor = (practice: PracticeRow) =>
  practice.personaId ? resolveCounterpart(getPack(practice.packId), practice.personaId) : null
```

with the import `import { laneFaces, resolveCounterpart } from "@/domains/cast"`. Pass `image={persona.image}` to both `PersonaAvatar` calls (the resume hero and the practice card).

In `FirstRun`, replace the discs:

```tsx
            <span className="mb-3.5 flex h-10">
              {laneFaces(pack, 3).map((face, i) => (
                <span
                  key={face.id}
                  className={cn(
                    "relative h-10 w-10 flex-none overflow-hidden rounded-full border-2 border-surface-raised bg-surface-2",
                    i > 0 && "-ml-2.5"
                  )}
                >
                  <Image src={face.image} alt="" fill sizes="40px" className="object-cover object-top" />
                </span>
              ))}
            </span>
```

Add `import Image from "next/image"` and drop the now-unused `personaInitials` import.

- [ ] **Step 3: Practice hub**

In `src/app/(app)/p/[practiceId]/page.tsx`, replace the persona lookup:

```ts
  const persona = practice.personaId ? resolveCounterpart(pack, practice.personaId) : null
```

with the import `import { resolveCounterpart } from "@/domains/cast"`, and pass `image={persona.image}` to its `PersonaAvatar`.

- [ ] **Step 4: Export route**

In `src/app/api/export/route.ts`:

```ts
        personaName: practice.personaId
          ? (resolveCounterpart(pack, practice.personaId)?.name ?? null)
          : null,
```

with the import `import { resolveCounterpart } from "@/domains/cast"`.

- [ ] **Step 5: Typed form and confirm brief**

In `TypedForm.tsx` and `ConfirmBrief.tsx`, the local `counterpart` is `lockedPersona(pack, variant)` and is used for two things: the intake CTA and a "{First} reads…" line. Change both to `lockedArchetype(pack, variant)`, pass it to `intakeCta`, and change the two copy lines so they no longer name a face (none is drawn yet):

TypedForm: `{counterpart ? "Your counterpart reads" : "Your counterpart reads"}` collapses to the single string `"Your counterpart reads"` (delete the ternary).

ConfirmBrief: the ternary becomes the single string `"Your counterpart reads these before the session:"`.

If the `counterpart` variable is then used only for the CTA, keep it named `locked`.

- [ ] **Step 6: Typecheck and tests**

Run: `npx tsc --noEmit -p .` and `pnpm test`
Expected: the only remaining typecheck errors are in `PanelSetup.tsx` (Task 6). All tests pass.

- [ ] **Step 7: Stop for review.** Do not commit.

---

### Task 6: The counterpart stage, rendered from the cast

**Files:**
- Rewrite: `src/components/simulation/intake/PanelSetup.tsx`

**Interfaces:**
- Consumes: `resolveCounterpart`, `castOf` (Task 1); `lockedArchetype`, `variantOf` (Task 2); `practices.ensureCast`, `practices.faceAgain`, `practices.metFaces`, `sessions.create({ practiceId, archetypeId?, micCheck? })` (Task 4).

The file keeps its component name and export (the route imports `PanelSetup`). Behavior:

- If the practice has no `cast`, call `ensureCast` once and render nothing until it lands.
- **Meet shape** when the practice already has a face (`practice.personaId`) or the variant locks one archetype: one card for `resolveCounterpart(pack, practice.personaId ?? cast[locked.id])`.
- **Chooser shape** otherwise: one card per archetype with `resolveCounterpart(pack, cast[archetype.id])`.
- Order: heading, room line, cards, mic check, receipts, error, consent.
- Selection: the Signal Blue pill marks the selected card and moves with it; the recommendation (first visit) or continuity (return) note is a colorless stamp.
- Face again: below a card, when `metFaces` holds a face in that archetype other than the drawn one and the practice has no sessions, a text link "Face {First} again instead".

- [ ] **Step 1: Write the new `PanelSetup.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { castOf, resolveCounterpart } from "@/domains/cast"
import { getPack, lockedArchetype, variantOf } from "@/domains/registry"
import {
  firstNameOf,
  scopeList,
  scopeText,
  type Archetype,
  type Counterpart,
  type DomainPack,
  type Scope,
} from "@/domains/types"
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/shared/buttons"
import { ReceiptChip } from "@/components/shared/ReceiptChip"
import { StageKicker } from "@/components/simulation/flow/FlowShell"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"
import { MicCheck } from "@/components/simulation/intake/MicCheck"
import type { MicCheckResult } from "@/lib/micCheck"

// The archetype whose declared territory (tags + attack line) overlaps the
// thing the user asked to have challenged; the pack's own opinion first.
// No match, no invented reason.
const recommendArchetype = (pack: DomainPack, scope: Scope): { archetype: Archetype; reason: string } => {
  const packPick = pack.recommendArchetype?.(scope) ?? null
  const picked = packPick && pack.archetypes.find((a) => a.id === packPick.archetypeId)
  if (picked && packPick) return { archetype: picked, reason: packPick.reason }
  const focus = scopeList(scope, "focusAreas")[0] ?? scopeText(scope, "focusAreas")
  if (focus) {
    const words = focus.toLowerCase().split(/\s+/).filter((word) => word.length > 3)
    for (const archetype of pack.archetypes) {
      const territory = [...archetype.tags, ...archetype.attack.map((s) => s.text)].join(" ").toLowerCase()
      if (words.some((word) => territory.includes(word))) {
        return { archetype, reason: `Targets ${focus.toLowerCase()}` }
      }
    }
  }
  return { archetype: pack.archetypes[0], reason: "A strong first read" }
}

const roomLine = (minutes: number, closingRead: boolean, first: string | null) =>
  closingRead
    ? `${minutes} min · ends on their verdict or the clock · debrief after`
    : `${minutes} min · ${first ?? "they"} decide${first ? "s" : ""} in the first thirty seconds · debrief after`

const PortraitTile = ({ counterpart, className }: { counterpart: Counterpart; className?: string }) => (
  <div className={cn("relative overflow-hidden bg-surface-2", className)}>
    <Image
      src={counterpart.image}
      alt=""
      fill
      priority
      sizes="(max-width: 768px) 100vw, 320px"
      // Top-anchored crop keeps the face when a portrait-orientation photo
      // meets the wide tile.
      className="object-cover object-top"
    />
    <span className="absolute bottom-2 left-2.5 font-mono text-[10px] font-medium uppercase tracking-[.1em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,.45)]">
      {counterpart.shortRole}
    </span>
  </div>
)

const AttackLine = ({ counterpart }: { counterpart: Counterpart }) => (
  <p className="text-[13px] leading-normal text-on-surface-2">
    {counterpart.attack.map((segment, i) => (
      <span key={i} className={segment.strong ? "font-medium text-on-surface" : undefined}>
        {segment.text}
      </span>
    ))}
  </p>
)

const Stamp = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-block rounded-full border border-line-2 bg-surface-2 px-[9px] py-[2.5px] text-[10px] font-semibold uppercase tracking-[.08em] text-on-surface-2">
    {children}
  </span>
)

const FaceAgain = ({
  practiceId,
  counterpart,
}: {
  practiceId: Id<"practices">
  counterpart: Counterpart
}) => {
  const faceAgain = useMutation(api.practices.faceAgain)
  return (
    <button
      type="button"
      onClick={() => faceAgain({ id: practiceId, personaId: counterpart.id })}
      className="focus-ring text-[12.5px] text-on-surface-3 underline-offset-2 hover:text-accent-blue hover:underline"
    >
      Face {firstNameOf(counterpart.name)} again instead
    </button>
  )
}

const CONSENT =
  "Sessions are live voice conversations with an AI avatar. Entering the room is your consent to your audio being transcribed and the conversation being processed, and possibly recorded, by our avatar provider to run the session."

type PanelSetupProps = {
  simulationId: string
}

export const PanelSetup = ({ simulationId }: PanelSetupProps) => {
  const router = useRouter()
  const typedId = simulationId as Id<"practices">
  const practice = useQuery(api.practices.get, { id: typedId })
  const liveSession = useQuery(api.sessions.getLive, { practiceId: typedId })
  const materials = useQuery(api.materials.listByPractice, { practiceId: typedId })
  const met = useQuery(api.practices.metFaces, practice ? { packId: practice.packId } : "skip")
  const ensureCast = useMutation(api.practices.ensureCast)
  const createSession = useMutation(api.sessions.create)
  const [starting, setStarting] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [enterFailed, setEnterFailed] = useState(false)
  // Advisory only: entering never depends on it.
  const [micCheck, setMicCheck] = useState<MicCheckResult | null>(null)

  // Practices from before casts get one here. The mutation is a no-op once
  // the cast exists, so this runs at most once per practice.
  const needsCast = practice !== undefined && practice !== null && !practice.cast
  useEffect(() => {
    if (needsCast) void ensureCast({ id: typedId })
  }, [needsCast, ensureCast, typedId])

  const handleEnterRoom = async (archetypeId: string) => {
    if (starting) return
    setStarting(true)
    setEnterFailed(false)
    try {
      await createSession({
        practiceId: typedId,
        archetypeId,
        ...(micCheck
          ? { micCheck: { verdict: micCheck.verdict, noiseDb: micCheck.noiseDb, voiceDb: micCheck.voiceDb } }
          : {}),
      })
      router.push(`/simulation/${simulationId}/room`)
    } catch {
      setEnterFailed(true)
      setStarting(false)
    }
  }

  if (practice === undefined || liveSession === undefined) return null
  if (practice === null) return <IdeaNotFound />
  const pack = getPack(practice.packId)
  const variant = variantOf(pack, practice.scope)
  const cast = practice.cast
  if (!cast) return null

  if (variant.prep && !practice.context) {
    return (
      <div>
        <StageKicker>{pack.copy.panel.kicker}</StageKicker>
        <p className="text-[13.5px] text-on-surface-2">
          Your brief is still being read. Your counterpart needs it before the questions start.{" "}
          <Link href={`/simulation/${simulationId}/analyze`} className="focus-ring underline hover:text-accent-blue">
            Back to the read
          </Link>
          .
        </p>
      </div>
    )
  }

  if (liveSession && !starting) {
    return (
      <div className="mx-auto max-w-[560px] pt-10 text-center">
        <h1 className="text-[20px] font-semibold tracking-[-.015em]">A session is already live.</h1>
        <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed text-on-surface-2">
          {liveSession.persona.name} is in the room for this practice. Rejoin to pick up where you left off.
        </p>
        <Link href={`/simulation/${simulationId}/room`} className={cn(BTN_PRIMARY, "mt-6 inline-flex")}>
          Rejoin the room <ArrowRight className="size-3.5" />
        </Link>
      </div>
    )
  }

  const locked = lockedArchetype(pack, variant)
  const fixedId = practice.personaId ?? (locked ? cast[locked.id] : undefined)
  const fixed = fixedId ? resolveCounterpart(pack, fixedId) : null
  const hasSessions = (practice.sessionCount ?? 0) > 0
  const openItems = (practice.continuity?.actionItems ?? []).filter((item) => item.status === "open").length
  const gapCount = practice.audit?.status === "ready" ? practice.audit.gaps.length : 0
  const docChips = (materials ?? []).map((material) => material.name)
  const metFaces = met ?? []
  const otherMet = (archetypeId: string, drawnId: string): Counterpart[] =>
    castOf(pack, archetypeId).flatMap((face) => {
      if (face.id === drawnId || !metFaces.includes(face.id)) return []
      const counterpart = resolveCounterpart(pack, face.id)
      return counterpart ? [counterpart] : []
    })
  const shownLine = roomLine(variant.roomMinutes, variant.closingRead, fixed ? firstNameOf(fixed.name) : null)

  return (
    <div className="mx-auto max-w-[980px] text-center">
      <h1 className="text-[20px] font-semibold tracking-[-.015em]">{pack.copy.panel.heading}</h1>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[.09em] text-on-surface-3">{shownLine}</p>
      <p className="mx-auto mb-9 mt-2.5 max-w-[54ch] text-sm leading-relaxed text-on-surface-2">
        {variant.prep && `${fixed ? `${firstNameOf(fixed.name)} has` : "They've all"} read your brief${docChips.length > 0 ? " and your documents" : ""}. `}
        {variant.copy.panelLead}
      </p>

      {fixed ? (
        <div className="mx-auto max-w-[660px] overflow-hidden rounded-2xl border border-line bg-surface-raised text-left shadow-card">
          <PortraitTile counterpart={fixed} className="aspect-[5/3] w-full" />
          <div className="p-7 pb-5 max-md:p-5 max-md:pb-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Stamp>
                {hasSessions
                  ? `Continue with ${firstNameOf(fixed.name)}${openItems > 0 ? ` · ${openItems} open` : ""}`
                  : pack.shortLabel}
              </Stamp>
              {pack.sessionMetaField && scopeText(practice.scope, pack.sessionMetaField) && (
                <span className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-on-surface-3">
                  {scopeText(practice.scope, pack.sessionMetaField)}
                </span>
              )}
            </div>
            <p className="text-[19px] font-semibold tracking-[-.015em]">{fixed.name}</p>
            <p className="mb-2.5 mt-0.5 text-[13px] text-on-surface-3">{fixed.role}</p>
            <AttackLine counterpart={fixed} />
            <p className="mt-3 font-serif text-[15px] italic leading-normal text-on-surface-2">
              &ldquo;{fixed.signature}&rdquo;
            </p>
          </div>
          {variant.prep && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface px-7 py-3.5 max-md:px-5">
              <span className="text-xs text-on-surface-3">{firstNameOf(fixed.name)}&apos;s read:</span>
              <ReceiptChip label="Your brief" />
              {docChips.map((name) => (
                <ReceiptChip key={name} label={name} />
              ))}
              {gapCount > 0 && <ReceiptChip label={`The gap map · ${gapCount} open`} />}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3.5 border-t border-line px-7 py-4 max-md:px-5">
            <button
              type="button"
              onClick={() => handleEnterRoom(fixed.archetypeId)}
              disabled={starting}
              className={BTN_PRIMARY}
            >
              {starting ? "Opening the room" : "Enter the room"}
              {!starting && <ArrowRight className="size-3.5" />}
            </button>
            {!hasSessions &&
              otherMet(fixed.archetypeId, fixed.id).map((face) => (
                <FaceAgain key={face.id} practiceId={typedId} counterpart={face} />
              ))}
          </div>
        </div>
      ) : (
        <ChooserCards
          pack={pack}
          scope={practice.scope}
          cast={cast}
          selectedId={selectedId}
          onSelect={setSelectedId}
          starting={starting}
          onEnter={handleEnterRoom}
          practiceId={typedId}
          otherMet={otherMet}
        />
      )}

      <MicCheck
        counterpartFirstName={fixed ? firstNameOf(fixed.name) : null}
        onResult={setMicCheck}
      />

      {!fixed && (
        <p className="mt-7 flex flex-wrap items-center justify-center gap-2 text-[12.5px] text-on-surface-3">
          They&apos;ve all read:
          <ReceiptChip label="Your brief" />
          {docChips.map((name) => (
            <ReceiptChip key={name} label={name} />
          ))}
          <span>· You can face the others in another practice.</span>
        </p>
      )}

      {enterFailed && (
        <p role="alert" className="mt-5 text-[13px] text-red-fg">
          Couldn&apos;t open the room. Check your connection and try again.
        </p>
      )}

      <p className="mx-auto mt-9 max-w-[560px] text-[11.5px] leading-relaxed text-ink-4">{CONSENT}</p>
    </div>
  )
}

const ChooserCards = ({
  pack,
  scope,
  cast,
  selectedId,
  onSelect,
  starting,
  onEnter,
  practiceId,
  otherMet,
}: {
  pack: DomainPack
  scope: Scope
  cast: Record<string, string>
  selectedId: string | null
  onSelect: (archetypeId: string) => void
  starting: boolean
  onEnter: (archetypeId: string) => void
  practiceId: Id<"practices">
  otherMet: (archetypeId: string, drawnId: string) => Counterpart[]
}) => {
  const recommended = recommendArchetype(pack, scope)
  const activeId = selectedId ?? recommended.archetype.id
  return (
    <div className="mb-6 grid grid-cols-3 items-stretch gap-4 text-left max-lg:mx-auto max-lg:max-w-[440px] max-lg:grid-cols-1">
      {pack.archetypes.map((archetype) => {
        const counterpart = resolveCounterpart(pack, cast[archetype.id])
        if (!counterpart) return null
        const isSelected = activeId === archetype.id
        const isRecommended = archetype.id === recommended.archetype.id
        return (
          <div
            key={archetype.id}
            className={cn(
              "relative flex flex-col overflow-hidden rounded-2xl border bg-surface-raised shadow-card transition-colors",
              isSelected ? "border-accent-blue ring-1 ring-accent-blue" : "border-line"
            )}
          >
            {isSelected && (
              <span className="absolute left-1/2 top-3 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-blue px-3 py-[3px] text-[10px] font-semibold uppercase tracking-[.07em] text-primary-foreground">
                Your counterpart
              </span>
            )}
            <PortraitTile counterpart={counterpart} className="aspect-[5/3] w-full flex-none" />
            <div className="flex flex-1 flex-col px-5 pb-4 pt-4">
              {isRecommended && (
                <div className="mb-2">
                  <Stamp>Recommended · {recommended.reason}</Stamp>
                </div>
              )}
              <p className="text-base font-semibold tracking-[-.01em]">{counterpart.name}</p>
              <p className="mb-2.5 mt-0.5 text-[12.5px] text-on-surface-3">{counterpart.role}</p>
              <div className="flex-1 pb-3">
                <AttackLine counterpart={counterpart} />
              </div>
              <p className="border-t border-line pt-3 font-serif text-sm italic leading-normal text-on-surface-2">
                &ldquo;{counterpart.signature}&rdquo;
              </p>
            </div>
            <div className="flex flex-col gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={() => (isSelected ? onEnter(archetype.id) : onSelect(archetype.id))}
                onFocus={() => onSelect(archetype.id)}
                disabled={starting}
                className={cn(isSelected ? BTN_PRIMARY : BTN_SECONDARY, "w-full")}
              >
                {starting && isSelected ? "Opening the room" : `Practice with ${firstNameOf(counterpart.name)}`}
                {isSelected && !starting && <ArrowRight className="size-3.5" />}
              </button>
              {otherMet(archetype.id, counterpart.id).map((face) => (
                <FaceAgain key={face.id} practiceId={practiceId} counterpart={face} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

Two deliberate choices to keep, and why:

- The card is no longer a clickable `div`. The button selects on first click and enters on the second (or on focus plus Enter), which keeps one real control per card and matches the keyboard path.
- `ChooserCards` only renders when the practice has no sessions (a practice with sessions has a `personaId` and takes the meet shape), so the face-again links there never need the `hasSessions` guard.

- [ ] **Step 2: Typecheck, lint, tests**

Run: `npx tsc --noEmit -p .` then `pnpm lint` then `pnpm test`
Expected: all clean.

- [ ] **Step 3: Run the detector once over the changed UI**

Run: `"/Users/1tvalbrun/.claude/plugins/cache/impeccable/impeccable/4.3.1/skills/impeccable/scripts/impeccable" detect --json src/components/simulation/intake/PanelSetup.tsx "src/app/(app)/page.tsx" src/components/shared/PersonaAvatar.tsx`
Expected: only advisory font-size findings that DESIGN.md's prose documents (12.5px, 10px, 19px). Report anything else.

- [ ] **Step 4: Stop for review.** Do not commit. After review, run the hand checks from the spec against the dev deployment with the developer: a practice keeps its face across two sessions in every lane including a cold call; a new cold-call practice draws a different stranger; face-again refuses a face not in history and refuses after the first session; a client-supplied persona id no longer reaches `sessions.create` (call it from the Convex dashboard with a `personaId` arg and confirm the validator rejects it).

---

### Task 7: The personality push script

**Files:**
- Create: `scripts/push-personalities.ts`
- Create: `src/lib/castDocs.ts` and `src/lib/castDocs.test.ts` (the parsers, so they can be tested without network)
- Modify: `package.json` (a `cast:push` script)

**Interfaces:**
- Produces: `parsePersonalities(markdown, laneId): { role: string; body: string }[]`; `parseCastTable(readme): { lane: string; role: string; name: string }[]`; `parseIdTable(readme): Record<string, string>` keyed by character name.

- [ ] **Step 1: Write the failing parser tests**

Create `src/lib/castDocs.test.ts`:

```ts
import test from "node:test"
import assert from "node:assert/strict"
import { parseCastTable, parseIdTable, parsePersonalities } from "./castDocs.ts"

const personalities = `# Pitch a sale

## Meeting buyer

You are {{name}}, the buyer.

Second paragraph.

## Cold-call prospect

You are {{name}}, busy.
`

test("parsePersonalities splits a lane file into role sections", () => {
  const sections = parsePersonalities(personalities)
  assert.deepEqual(
    sections.map((s) => s.role),
    ["Meeting buyer", "Cold-call prospect"]
  )
  assert.equal(sections[0].body, "You are {{name}}, the buyer.\n\nSecond paragraph.")
})

const readme = `
| Lane | Role | Avatar | Custom voice | Preset fallback |
|---|---|---|---|---|
| sales | Meeting buyer | Cole Merritt | Man. | Nathan |
| sales | Cold-call prospect | Greg Hollis | Man. | Blake |

## Runway Character ids

| Slug | Character | Runway id |
|---|---|---|
| cole-merritt | Cole Merritt | 958d917a-716e-4a10-933d-5b1fc9684c19 |
| greg-hollis | Greg Hollis | d5b2d794-35b9-41d1-99ad-0a74f14db53b |
`

test("parseCastTable reads lane, role, and name per face", () => {
  assert.deepEqual(parseCastTable(readme), [
    { lane: "sales", role: "Meeting buyer", name: "Cole Merritt" },
    { lane: "sales", role: "Cold-call prospect", name: "Greg Hollis" },
  ])
})

test("parseIdTable maps character name to Runway id", () => {
  assert.equal(parseIdTable(readme)["Greg Hollis"], "d5b2d794-35b9-41d1-99ad-0a74f14db53b")
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test src/lib/castDocs.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Create `src/lib/castDocs.ts`**

```ts
// Parsers for docs/cast: the lane personality files and the README tables.
// Kept out of the script so they can be tested without the network.

export const parsePersonalities = (markdown: string): { role: string; body: string }[] =>
  markdown
    .split(/^## /m)
    .slice(1)
    .map((section) => {
      const newline = section.indexOf("\n")
      return { role: section.slice(0, newline).trim(), body: section.slice(newline + 1).trim() }
    })

const tableRows = (markdown: string, firstHeader: string): string[][] =>
  markdown
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith(`| ${firstHeader} `) && !line.startsWith("|---"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))

export const parseCastTable = (readme: string): { lane: string; role: string; name: string }[] =>
  tableRows(readme.split("## Runway Character ids")[0], "Lane").map(([lane, role, name]) => ({
    lane,
    role,
    name,
  }))

export const parseIdTable = (readme: string): Record<string, string> =>
  Object.fromEntries(
    tableRows(readme.split("## Runway Character ids")[1] ?? "", "Slug").map(([, name, id]) => [name, id])
  )
```

- [ ] **Step 4: Run the parser tests**

Run: `node --test src/lib/castDocs.test.ts`
Expected: 3 pass.

- [ ] **Step 5: Create `scripts/push-personalities.ts`**

```ts
// Pushes each role's personality to every face's Runway Character.
//   pnpm cast:push --dry-run   shows what would change, writes nothing
//   pnpm cast:push             updates every Character whose text differs
// Reads RUNWAYML_API_SECRET from .env.local (node --env-file).
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { parseCastTable, parseIdTable, parsePersonalities } from "../src/lib/castDocs.ts"

const API = "https://api.dev.runwayml.com"
const VERSION = "2024-11-06"
const CAST_DIR = path.join(process.cwd(), "docs/cast")
const dryRun = process.argv.includes("--dry-run")

const apiKey = process.env.RUNWAYML_API_SECRET
if (!apiKey) {
  console.error("RUNWAYML_API_SECRET is not set")
  process.exit(1)
}
const headers = {
  Authorization: `Bearer ${apiKey}`,
  "X-Runway-Version": VERSION,
  "Content-Type": "application/json",
}

const readme = await readFile(path.join(CAST_DIR, "README.md"), "utf8")
const faces = parseCastTable(readme)
const ids = parseIdTable(readme)

const personalities = new Map<string, string>()
for (const file of await readdir(path.join(CAST_DIR, "personalities"))) {
  const lane = path.basename(file, ".md")
  const markdown = await readFile(path.join(CAST_DIR, "personalities", file), "utf8")
  for (const { role, body } of parsePersonalities(markdown)) personalities.set(`${lane}|${role}`, body)
}

let changed = 0
for (const face of faces) {
  const id = ids[face.name]
  const template = personalities.get(`${face.lane}|${face.role}`)
  if (!id || !template) {
    console.error(`skip ${face.name}: ${id ? "no personality for" : "no Runway id for"} ${face.lane} / ${face.role}`)
    continue
  }
  const wanted = template.replaceAll("{{name}}", face.name)
  const current = await fetch(`${API}/v1/avatars/${id}`, { headers })
  if (!current.ok) {
    console.error(`skip ${face.name}: GET ${current.status}`)
    continue
  }
  const stored = ((await current.json()) as { personality?: string }).personality ?? ""
  if (stored === wanted) {
    console.log(`same  ${face.name}`)
    continue
  }
  changed += 1
  console.log(`${dryRun ? "would" : "push "} ${face.name} (${stored.length} → ${wanted.length} chars)`)
  if (dryRun) continue
  const updated = await fetch(`${API}/v1/avatars/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ personality: wanted }),
  })
  if (!updated.ok) console.error(`fail  ${face.name}: PATCH ${updated.status}`)
}
console.log(`${changed} of ${faces.length} differ${dryRun ? " (dry run, nothing written)" : ""}`)
```

- [ ] **Step 6: Add the script to `package.json`**

Next to `eval:signoff`:

```json
    "cast:push": "node --env-file=.env.local scripts/push-personalities.ts",
```

- [ ] **Step 7: Dry-run it**

Run: `pnpm cast:push --dry-run`
Expected: 27 lines, each `same` or `would`, and a summary. The three founder Characters with the stale panel text should show as `would`; most new ones should be `same` if their pasted text matched the files. Report the list. Do not run the write mode in this task; the developer decides when.

- [ ] **Step 8: Stop for review.** Do not commit.

---

### Task 8: Registration and the live checks (ops, not code)

**Files:** none.

- [ ] **Step 1: Register the 18 new faces on dev**

For each row below, run from the project root (dev deployment):

```bash
npx convex run avatars:register '{"packId":"founder","personaId":"vc-02","runwayAvatarId":"94f5e284-5874-476c-b1e7-ed5c953b2b51"}'
npx convex run avatars:register '{"packId":"founder","personaId":"vc-03","runwayAvatarId":"973cec5d-f2c8-4b3c-acac-9d225614cbec"}'
npx convex run avatars:register '{"packId":"founder","personaId":"tc-02","runwayAvatarId":"2632f8f8-71de-4e35-8bf8-32fb08ffd061"}'
npx convex run avatars:register '{"packId":"founder","personaId":"tc-03","runwayAvatarId":"20c14a23-6368-4d53-ac6b-a8b4771fa45b"}'
npx convex run avatars:register '{"packId":"founder","personaId":"ta-02","runwayAvatarId":"1b163e2e-8273-4d40-821c-d291666abc4e"}'
npx convex run avatars:register '{"packId":"founder","personaId":"ta-03","runwayAvatarId":"6beee5fc-69d1-4ab3-a8ee-18d9861d7b16"}'
npx convex run avatars:register '{"packId":"sales","personaId":"buyer-02","runwayAvatarId":"e0d0a1d6-45e2-4100-9a66-fa84a4699540"}'
npx convex run avatars:register '{"packId":"sales","personaId":"buyer-03","runwayAvatarId":"afb922f6-119f-439c-b516-ba069ccd807a"}'
npx convex run avatars:register '{"packId":"sales","personaId":"prospect-02","runwayAvatarId":"26a71a8b-1020-423a-bf14-8c526ac09b0e"}'
npx convex run avatars:register '{"packId":"sales","personaId":"prospect-03","runwayAvatarId":"8a60c7c9-e10c-420e-8c78-e948ee96ec85"}'
npx convex run avatars:register '{"packId":"audit","personaId":"assessor-02","runwayAvatarId":"0c665f5b-a187-4f86-87b2-986979e8a368"}'
npx convex run avatars:register '{"packId":"audit","personaId":"assessor-03","runwayAvatarId":"c46f24dc-1520-42b5-86d1-3ff266b4117f"}'
npx convex run avatars:register '{"packId":"interview","personaId":"screener-02","runwayAvatarId":"16e22462-0d03-4b97-8044-5f47932c9f70"}'
npx convex run avatars:register '{"packId":"interview","personaId":"screener-03","runwayAvatarId":"6992442f-398e-40f0-93aa-323844f44e0a"}'
npx convex run avatars:register '{"packId":"interview","personaId":"hm-02","runwayAvatarId":"12cb3477-169e-4ee4-81ce-f7506ee1d4dc"}'
npx convex run avatars:register '{"packId":"interview","personaId":"hm-03","runwayAvatarId":"7597a32e-0340-4adb-b390-1fdc3dd3e521"}'
npx convex run avatars:register '{"packId":"interview","personaId":"practitioner-02","runwayAvatarId":"fcbaa9c2-7c69-4294-b593-38608dc543f3"}'
npx convex run avatars:register '{"packId":"interview","personaId":"practitioner-03","runwayAvatarId":"9592dfaa-acc9-4c43-89a3-d31c63a098ac"}'
```

Verify: `npx convex data avatars --limit 40` shows 27 rows.

- [ ] **Step 2: Hand checks on dev** (the developer drives the browser; record each result)

1. New cold-call practice: note the drawn face. Run a session, end it, start a second session from the hub. Same face.
2. Second new cold-call practice: a different face than step 1's.
3. New founder practice: three cards, three faces, pick one, enter, end. Reopen the counterpart stage: the meet shape with "Continue with {First}".
4. On a fresh practice in a lane where you have met someone else: the "Face {First} again instead" link appears; click it; the card changes to that face. On a practice with a session: the link is absent.
5. From the Convex dashboard, call `sessions:create` with `{ practiceId, personaId: "buyer-03" }`: the validator rejects the unknown argument.
6. An old practice (created before this branch): open its counterpart stage; it shows the face it already had.

- [ ] **Step 3: Push the personalities**

Run: `pnpm cast:push --dry-run`, review, then `pnpm cast:push`. Re-run the dry run: every line reads `same`.

- [ ] **Step 4: Register on prod**

Repeat step 1 with `--prod` appended to each command. Verify with `npx convex data avatars --prod --limit 40`.

- [ ] **Step 5: Stop.** Report the results of every hand check.

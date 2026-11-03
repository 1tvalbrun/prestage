import test from "node:test"
import assert from "node:assert/strict"
import { ALL_PACKS, PACKS, lockedArchetype, variantOf } from "./registry.ts"
import { ROOM_MS } from "../lib/roomClock.ts"

// Type-level coverage rides along: this file only compiles/runs if every
// pack satisfies the discriminated prep contract.
test("every lane declares its prep stage", () => {
  assert.equal(PACKS.founder.prep.kind, "audit")
  assert.equal(PACKS.sales.prep.kind, "audit")
  assert.equal(PACKS.audit.prep.kind, "audit")
  assert.equal(ALL_PACKS.length, 4)
  assert.equal(PACKS.interview.prep.kind, "blueprint")
  for (const pack of ALL_PACKS) {
    assert.ok(pack.prep.stepLabel.length > 0)
  }
})

test("every lane declares its own start CTA — composing 'Start a {label}' reads broken", () => {
  for (const pack of ALL_PACKS) {
    assert.ok(pack.startCta.startsWith("Start "), `${pack.id}: "${pack.startCta}"`)
    // The bug this guards: templating the label produced "Start a face an
    // audit practice". The CTA must not embed the lane label verbatim.
    assert.ok(
      !pack.startCta.toLowerCase().includes(pack.label.toLowerCase()),
      `${pack.id}: CTA embeds the label: "${pack.startCta}"`
    )
  }
})

test("verdict values stay distinct across packs (findVerdict is first-match-wins)", () => {
  const values = ALL_PACKS.flatMap((pack) => pack.verdicts.options.map((option) => option.value))
  assert.equal(new Set(values).size, values.length)
})

test("the interview lane's cast and vocabulary match the spec", () => {
  assert.deepEqual(
    PACKS.interview.personas.map((persona) => persona.id),
    ["screener-01", "screener-02", "screener-03", "hm-01", "hm-02", "hm-03", "practitioner-01", "practitioner-02", "practitioner-03"]
  )
  assert.deepEqual(
    PACKS.interview.verdicts.options.map((option) => option.value),
    ["move-forward", "on-the-fence", "not-yet"]
  )
  assert.equal(PACKS.interview.verdicts.fallback, "on-the-fence")
  assert.equal(PACKS.interview.subjectField, "roleTitle")
  // The engine's focusAreas persona heuristic and the session-meta key.
  assert.ok(PACKS.interview.scopeFields.some((field) => field.key === "focusAreas"))
  assert.equal(PACKS.interview.sessionMetaField, "interviewType")
})

test("the interview format drives the recommended archetype; unset reads as a full loop", () => {
  const recommend = PACKS.interview.recommendArchetype
  assert.ok(recommend)
  assert.equal(recommend({ interviewType: "Screening call" })?.archetypeId, "recruiter_screen")
  assert.equal(recommend({ interviewType: "Behavioral" })?.archetypeId, "hiring_manager")
  assert.equal(recommend({ interviewType: "Technical & scenarios" })?.archetypeId, "domain_practitioner")
  assert.equal(recommend({ interviewType: "Full loop (mixed)" })?.archetypeId, "hiring_manager")
  assert.equal(recommend({})?.archetypeId, "hiring_manager")
})

test("a pack without variants resolves to its own shape, whatever the scope", () => {
  const variant = variantOf(PACKS.founder, { anything: "at all" })
  assert.equal(variant.scopeFields, PACKS.founder.scopeFields)
  assert.equal(variant.prep, true)
  assert.equal(variant.archetypeId, null)
  assert.equal(variant.roomMinutes, ROOM_MS / 60_000)
  assert.equal(variant.closingRead, true)
  assert.equal(variant.remembers, true)
  assert.equal(variant.verdicts, PACKS.founder.verdicts)
  assert.equal(variant.copy.panelLead, PACKS.founder.copy.panel.lead)
  assert.equal(variant.copy.preview, PACKS.founder.copy.preview)
  assert.equal(variant.copy.formSections, PACKS.founder.copy.form.sections)
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

test("the sales lane's call types pick the buyer and the vocabulary", () => {
  assert.equal(PACKS.sales.variantField, "callType")
  assert.deepEqual(
    PACKS.sales.personas.map((persona) => persona.id),
    ["buyer-01", "buyer-02", "buyer-03", "prospect-01", "prospect-02", "prospect-03"]
  )
  assert.deepEqual(
    PACKS.sales.verdicts.options.map((option) => option.value),
    ["buy", "second-meeting", "walk", "booked", "follow-up", "brushed-off"]
  )
  assert.equal(PACKS.sales.sessionMetaField, "callType")
})

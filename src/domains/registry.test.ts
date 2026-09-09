import test from "node:test"
import assert from "node:assert/strict"
import { ALL_PACKS, PACKS, lockedPersona, variantOf } from "./registry.ts"
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
    ["screener-01", "hm-01", "practitioner-01"]
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

test("the interview recommendation follows the interview type and defaults to the full loop", () => {
  const recommend = PACKS.interview.recommendPersona
  assert.ok(recommend)
  assert.equal(recommend({ interviewType: "Screening call" })?.personaId, "screener-01")
  assert.equal(recommend({ interviewType: "Behavioral" })?.personaId, "hm-01")
  assert.equal(recommend({ interviewType: "Technical & scenarios" })?.personaId, "practitioner-01")
  assert.equal(recommend({ interviewType: "Full loop (mixed)" })?.personaId, "hm-01")
  assert.equal(recommend({})?.personaId, "hm-01")
})

test("a pack without variants resolves to its own shape, whatever the scope", () => {
  const variant = variantOf(PACKS.founder, { anything: "at all" })
  assert.equal(variant.scopeFields, PACKS.founder.scopeFields)
  assert.equal(variant.prep, true)
  assert.equal(variant.personaId, null)
  assert.equal(variant.roomMinutes, ROOM_MS / 60_000)
  assert.equal(variant.closingRead, true)
  assert.equal(variant.remembers, true)
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

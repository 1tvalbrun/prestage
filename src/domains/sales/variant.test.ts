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
  assert.equal(variant.remembers, false)
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
    {
      [CALL_TYPE_KEY]: COLD_CALL,
      offering: "CourtFlow",
      prospect: "Owner of a 12-court club",
      goal: "Book a meeting",
    },
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

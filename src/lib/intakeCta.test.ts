import test from "node:test"
import assert from "node:assert/strict"
import { confirmLabel, intakeCta } from "./intakeCta.ts"
import { ALL_PACKS, getPack, lockedPersona, variantOf } from "../domains/registry.ts"
import { CALL_TYPE_KEY, COLD_CALL, PITCH_MEETING } from "../domains/sales/variant.ts"
import type { Scope } from "../domains/types.ts"

// The button must name where submitting goes. Every lane with prep goes to
// the read first, whoever it locks; only the cold call meets its panelist
// next.

const ctaFor = (packId: string, scope: Scope = {}) => {
  const pack = getPack(packId)
  const variant = variantOf(pack, scope)
  return intakeCta(pack, variant, lockedPersona(pack, variant))
}

test("founder: the pre-read comes before the panel choice", () => {
  const cta = ctaFor("founder")
  assert.equal(cta.label, "Run the pre-read")
  assert.match(cta.hint, /choose who to face after/)
})

test("sales pitch meeting: the pre-read comes before Cole", () => {
  const cta = ctaFor("sales", { [CALL_TYPE_KEY]: PITCH_MEETING })
  assert.equal(cta.label, "Run the pre-read")
  assert.equal(cta.hint, "Cole reads everything before the first question.")
})

test("sales cold call: no prep, Greg is next", () => {
  const cta = ctaFor("sales", { [CALL_TYPE_KEY]: COLD_CALL })
  assert.equal(cta.label, "Meet Greg")
  assert.equal(cta.hint, "Greg knows nothing about you until you speak.")
})

test("audit: the pre-read comes before Priya", () => {
  const cta = ctaFor("audit")
  assert.equal(cta.label, "Run the pre-read")
  assert.equal(cta.hint, "Priya reads everything before the first question.")
})

test("interview: the blueprint comes before the interviewer", () => {
  const cta = ctaFor("interview")
  assert.equal(cta.label, "Build the blueprint")
  assert.match(cta.hint, /questions for you/)
})

test("no lane's button says meet someone while prep stands between", () => {
  for (const pack of ALL_PACKS) {
    const variant = variantOf(pack, {})
    if (!variant.prep) continue
    const cta = intakeCta(pack, variant, lockedPersona(pack, variant))
    assert.doesNotMatch(cta.label, /^Meet |Choose your panel/, pack.id)
  }
})

test("the voice confirm folds the beat into its label", () => {
  assert.equal(confirmLabel({ label: "Run the pre-read", hint: "" }), "Looks right, run the pre-read")
  assert.equal(confirmLabel({ label: "Meet Greg", hint: "" }), "Looks right, meet Greg")
})

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

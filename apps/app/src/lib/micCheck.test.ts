import test from "node:test"
import assert from "node:assert/strict"
import {
  GOOD_GAP_DB,
  LOUD_FLOOR_DB,
  MIN_DB,
  NOISY_GAP_DB,
  QUIET_FLOOR_DB,
  SILENT_GAP_DB,
  dbfs,
  failureFrom,
  median,
  micVerdict,
  percentile,
} from "./micCheck.ts"

test("dbfs converts linear RMS to decibels and clamps silence to the floor", () => {
  assert.equal(dbfs(1), 0)
  assert.ok(Math.abs(dbfs(0.1) - -20) < 1e-9)
  assert.equal(dbfs(0), MIN_DB)
  assert.equal(dbfs(-0.5), MIN_DB)
  assert.equal(dbfs(1e-9), MIN_DB)
})

test("median is robust to a single loud event and honest about nothing", () => {
  assert.equal(median([]), MIN_DB)
  assert.equal(median([3]), 3)
  assert.equal(median([1, 2, 3, 100]), 2.5)
  assert.equal(median([5, 5, 5]), 5)
  // Order of arrival must not matter.
  assert.equal(median([100, 1, 3, 2]), 2.5)
})

test("percentile is nearest-rank on the sorted samples", () => {
  assert.equal(percentile([], 0.9), MIN_DB)
  assert.equal(percentile([7], 0.9), 7)
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9), 9)
  assert.equal(percentile([10, 1, 5], 0.5), 5)
  assert.equal(percentile([4, 4, 4, 4], 0.9), 4)
})

test("the verdict follows the floor and the gap at every boundary", () => {
  const quiet = QUIET_FLOOR_DB
  // A voice that barely clears the floor is a mic that heard nothing.
  assert.equal(micVerdict(quiet, quiet + SILENT_GAP_DB - 1), "silent")
  assert.equal(micVerdict(LOUD_FLOOR_DB, LOUD_FLOOR_DB + SILENT_GAP_DB - 1), "silent")
  // A loud floor is noisy however clear the voice.
  assert.equal(micVerdict(LOUD_FLOOR_DB, LOUD_FLOOR_DB + GOOD_GAP_DB + 10), "noisy")
  // A small gap is noisy even in a quiet room.
  assert.equal(micVerdict(quiet, quiet + NOISY_GAP_DB - 1), "noisy")
  // Quiet floor and a good gap is the clean case.
  assert.equal(micVerdict(quiet, quiet + GOOD_GAP_DB), "good")
  assert.equal(micVerdict(quiet - 20, quiet - 20 + GOOD_GAP_DB), "good")
  // Between: a moderate floor, or a gap short of good.
  assert.equal(micVerdict(quiet + 1, quiet + 1 + GOOD_GAP_DB), "workable")
  assert.equal(micVerdict(quiet, quiet + GOOD_GAP_DB - 1), "workable")
  assert.equal(micVerdict(LOUD_FLOOR_DB - 1, LOUD_FLOOR_DB - 1 + NOISY_GAP_DB), "workable")
})

test("browser errors map to a closed set of failures by name", () => {
  const named = (name: string) => Object.assign(new Error("x"), { name })
  assert.equal(failureFrom(named("NotAllowedError")), "denied")
  assert.equal(failureFrom(named("SecurityError")), "denied")
  assert.equal(failureFrom(named("NotFoundError")), "no-device")
  assert.equal(failureFrom(named("OverconstrainedError")), "no-device")
  assert.equal(failureFrom(named("NotReadableError")), "busy")
  assert.equal(failureFrom(named("AbortError")), "busy")
  assert.equal(failureFrom(named("TypeError")), "unavailable")
  assert.equal(failureFrom("not an error"), "unavailable")
  assert.equal(failureFrom(undefined), "unavailable")
})

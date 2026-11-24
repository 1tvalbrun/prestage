import test from "node:test"
import assert from "node:assert/strict"
import { filterPractices } from "./findPractices.ts"

const rows = [
  { name: "Remindly", packId: "sales" },
  { name: "Dispatch software for service fleets", packId: "sales" },
  { name: "Dispatch software, hospital transport", packId: "sales" },
  { name: "Acme Cloud ISMS", packId: "audit" },
]

test("no query and no lane returns everything", () => {
  assert.deepEqual(filterPractices(rows, "", null), rows)
  assert.deepEqual(filterPractices(rows, "   ", null), rows)
})

test("query matches anywhere in the name, ignoring case and edges", () => {
  assert.deepEqual(
    filterPractices(rows, "  DISPATCH ", null).map((row) => row.name),
    ["Dispatch software for service fleets", "Dispatch software, hospital transport"]
  )
})

test("lane alone filters by pack", () => {
  assert.deepEqual(filterPractices(rows, "", "audit"), [rows[3]])
})

test("query and lane combine", () => {
  assert.deepEqual(filterPractices(rows, "dispatch", "audit"), [])
  assert.equal(filterPractices(rows, "hospital", "sales").length, 1)
})

test("no match is empty, not everything", () => {
  assert.deepEqual(filterPractices(rows, "zzz", null), [])
})

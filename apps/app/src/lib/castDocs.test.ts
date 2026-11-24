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

import test from "node:test"
import assert from "node:assert/strict"
import {
  RECONCILE_MAX_MS,
  REPLY_WAIT_MAX_MS,
  RIBBON_MAX_MS,
  RIBBON_MS,
  SIGN_OFF_PROMPT,
  landAfterRibbon,
  renderWindow,
  resolveSignOff,
  signOffLines,
  signOffPhase,
} from "./signOff.ts"

const T0 = 1_000_000
const base = {
  closingRead: false,
  now: T0 + 1_000,
  avatarSpeaking: false,
  avatarSpokeAt: null,
  userHeardAt: null,
}

test("no sign-off, or a user sign-off in a verdict lane, never lands", () => {
  assert.equal(signOffPhase({ ...base, signOff: undefined }), "none")
  assert.equal(
    signOffPhase({ ...base, closingRead: true, signOff: { by: "user", at: T0, turnAt: T0 } }),
    "none"
  )
})

test("both said goodbye: drop at once", () => {
  assert.equal(signOffPhase({ ...base, signOff: { by: "both", at: T0, turnAt: T0 } }), "drop")
})

test("user signed off: no reply drops at the cap; a reply hands the decision to the check on it", () => {
  const signOff = { by: "user" as const, at: T0, turnAt: T0 - 2_000 }
  assert.equal(signOffPhase({ ...base, signOff }), "waiting")
  assert.equal(signOffPhase({ ...base, signOff, now: T0 + REPLY_WAIT_MAX_MS }), "drop")
  // Speech from before the goodbye is not a reply.
  assert.equal(signOffPhase({ ...base, signOff, now: T0 + REPLY_WAIT_MAX_MS, avatarSpokeAt: T0 - 5_000 }), "drop")
  // A reply started: the server will upgrade or clear the stamp; hold.
  assert.equal(signOffPhase({ ...base, signOff, now: T0 + REPLY_WAIT_MAX_MS, avatarSpokeAt: T0 - 1_000 }), "waiting")
  // Unless the reply never classifies.
  assert.equal(signOffPhase({ ...base, signOff, now: T0 + RECONCILE_MAX_MS, avatarSpokeAt: T0 - 1_000 }), "drop")
})

test("panelist signed off: drop at once (the ribbon is the user's window); a user reply hands the decision to the check on it", () => {
  const signOff = { by: "panelist" as const, at: T0, turnAt: T0 }
  assert.equal(signOffPhase({ ...base, signOff, now: T0 + 1 }), "drop")
  // The persona still finishing the goodbye: hold.
  assert.equal(signOffPhase({ ...base, signOff, now: T0 + 1, avatarSpeaking: true }), "waiting")
  // The user spoke after the goodbye: hold for the check.
  assert.equal(signOffPhase({ ...base, signOff, now: T0 + 2_000, userHeardAt: T0 + 500 }), "waiting")
  assert.equal(signOffPhase({ ...base, signOff, now: T0 + RECONCILE_MAX_MS, userHeardAt: T0 + 500 }), "drop")
  // Speech from before the goodbye is not a reply.
  assert.equal(signOffPhase({ ...base, signOff, now: T0 + 1, userHeardAt: T0 - 500 }), "drop")
})

test("verdict lanes land on the panelist's sign-off the same way", () => {
  const signOff = { by: "panelist" as const, at: T0, turnAt: T0 }
  assert.equal(signOffPhase({ ...base, closingRead: true, signOff, now: T0 + 1 }), "drop")
})

test("the ribbon holds for its beat and for a speaker mid-line, never past the cap", () => {
  assert.equal(landAfterRibbon(T0, T0 + RIBBON_MS - 1, false), false)
  assert.equal(landAfterRibbon(T0, T0 + RIBBON_MS, false), true)
  assert.equal(landAfterRibbon(T0, T0 + RIBBON_MS, true), false)
  assert.equal(landAfterRibbon(T0, T0 + RIBBON_MAX_MS, true), true)
})

test("the window is the last eight turns after a dismissal, numbered and labeled, with the provisional line last", () => {
  const turns = Array.from({ length: 10 }, (_, i) => ({
    type: (i % 2 === 0 ? "panelist" : "user") as "panelist" | "user",
    text: `turn ${i}`,
    timestamp: T0 + i * 1_000,
  }))
  const lines = renderWindow(signOffLines(turns, undefined, undefined)).split("\n")
  assert.equal(lines.length, 8)
  assert.equal(lines[0], "1 PANELIST: turn 2")
  assert.equal(lines[7], "8 USER: turn 9")
  const after = renderWindow(signOffLines(turns, T0 + 6_500, "have a good day")).split("\n")
  assert.deepEqual(after, [
    "1 USER: turn 7",
    "2 PANELIST: turn 8",
    "3 USER: turn 9",
    "4 PANELIST: have a good day",
  ])
})

test("who signed off comes from the labels of the last two lines, never the model", () => {
  const lines = (...types: ("user" | "panelist")[]) =>
    types.map((type) => ({ type, text: "a full sentence with several words in it" }))
  assert.equal(resolveSignOff(lines("panelist", "user"), [2]), "user")
  assert.equal(resolveSignOff(lines("user", "panelist"), [2]), "panelist")
  assert.equal(resolveSignOff(lines("panelist", "user"), [1, 2]), "both")
  // A goodbye the other party talked past is not an ending.
  assert.equal(resolveSignOff(lines("panelist", "user"), [1]), null)
  // Two sign-offs by the same party are one party's sign-off.
  assert.equal(resolveSignOff(lines("user", "user"), [1, 2]), "user")
  assert.equal(resolveSignOff(lines("user"), []), null)
  assert.equal(resolveSignOff([], [1]), null)
})

test("a line that ends with a question never signs off, whatever the model flagged", () => {
  const lastChance = [
    { type: "user" as const, text: "Who handles a double booking?" },
    { type: "panelist" as const, text: "Our team. I need to get back to work, anything else?" },
  ]
  assert.equal(resolveSignOff(lastChance, [2]), null)
  const echo = [
    { type: "user" as const, text: "That was all. Goodbye." },
    { type: "panelist" as const, text: "Goodbye? Did you want to send something to my email?" },
  ]
  assert.equal(resolveSignOff(echo, [1, 2]), null)
})

test("a short reply to a goodbye is the acknowledgment it is", () => {
  const ack = [
    { type: "panelist" as const, text: "I've got to get back to it. Have a good day." },
    { type: "user" as const, text: "Understood, you too. Bye." },
  ]
  assert.equal(resolveSignOff(ack, [1]), "both")
  const continues = [
    { type: "user" as const, text: "That was all. Goodbye." },
    { type: "panelist" as const, text: "Before you go, let me ask one thing about your fleet." },
  ]
  assert.equal(resolveSignOff(continues, [1]), null)
})

test("the prompt asks for line numbers and excludes look-alikes", () => {
  for (const marker of ['"signOffLines"', "quoted", "greeting", "final question", "numbered", "last chance"]) {
    assert.ok(SIGN_OFF_PROMPT.toLowerCase().includes(marker.toLowerCase()), `missing: ${marker}`)
  }
})

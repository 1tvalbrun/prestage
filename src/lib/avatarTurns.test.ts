import test from "node:test"
import assert from "node:assert/strict"
import { commitPending, emptySegment, ingestText, pendingText } from "./avatarTurns.ts"

// Runway replays every avatar line under one segment id with cumulative
// text, so a turn's text is whatever arrived since the last commit, and
// its onset is when that first new chunk arrived.

test("the first line commits whole, stamped from its first chunk", () => {
  let state = ingestText(emptySegment(), "Yeah, what's", 1000)
  state = ingestText(state, "Yeah, what's this about?", 1400)
  const { next, line } = commitPending(state)
  assert.deepEqual(line, { text: "Yeah, what's this about?", spokenAt: 1000 })
  assert.equal(next.committedLength, "Yeah, what's this about?".length)
  assert.equal(next.segmentStartedAt, null)
})

test("the next line commits only the text since the last commit", () => {
  let state = ingestText(emptySegment(), "Yeah, what's this about?", 1000)
  state = commitPending(state).next
  state = ingestText(state, "Yeah, what's this about? Look, I'm busy.", 5000)
  state = ingestText(state, "Yeah, what's this about? Look, I'm busy. What do you sell?", 5600)
  const { line } = commitPending(state)
  assert.deepEqual(line, { text: "Look, I'm busy. What do you sell?", spokenAt: 5000 })
})

test("nothing new on the wire commits nothing and leaves the state alone", () => {
  const state = commitPending(ingestText(emptySegment(), "Hello there.", 1000)).next
  const { next, line } = commitPending(state)
  assert.equal(line, null)
  assert.deepEqual(next, state)
})

test("whitespace-only growth is not a line", () => {
  let state = commitPending(ingestText(emptySegment(), "Hello there.", 1000)).next
  state = ingestText(state, "Hello there.  ", 2000)
  assert.equal(pendingText(state), "")
  assert.equal(commitPending(state).line, null)
})

test("a segment whose text shrinks starts over from nothing committed", () => {
  let state = commitPending(ingestText(emptySegment(), "A long first line here.", 1000)).next
  state = ingestText(state, "Short.", 3000)
  assert.deepEqual(commitPending(state).line, { text: "Short.", spokenAt: 3000 })
})

test("a per-turn segment (one line per id) commits its full text", () => {
  const state = ingestText(emptySegment(), "One line, one id.", 1000)
  assert.deepEqual(commitPending(state).line, { text: "One line, one id.", spokenAt: 1000 })
})

import test from "node:test"
import assert from "node:assert/strict"
import {
  ROOM_MS,
  RESOLVE_MS,
  MIN_RECONNECT_MS,
  TIME_FINISH_GRACE_MS,
  LAST_WORD_MAX_MS,
  coldTimeUp,
  roomTimePhase,
  remainingMs,
  shouldInvite,
  maxDurationSec,
  shouldLandOnTime,
  pickInvitation,
  INVITATIONS,
} from "./roomClock.ts"

const T0 = 1_000_000

test("phases move open → closing → resolving → over at the documented fractions", () => {
  assert.equal(roomTimePhase(T0, T0), "open")
  assert.equal(roomTimePhase(T0, T0 + ROOM_MS * 0.8 - 1), "open")
  assert.equal(roomTimePhase(T0, T0 + ROOM_MS * 0.8), "closing")
  assert.equal(roomTimePhase(T0, T0 + ROOM_MS - RESOLVE_MS), "resolving")
  assert.equal(roomTimePhase(T0, T0 + ROOM_MS), "over")
})

test("phases scale with a shorter room (free tier is a parameter, not a fork)", () => {
  const short = 180_000
  assert.equal(roomTimePhase(T0, T0 + short * 0.8, short), "closing")
  assert.equal(roomTimePhase(T0, T0 + short, short), "over")
})

test("remainingMs clamps at zero", () => {
  assert.equal(remainingMs(T0, T0), ROOM_MS)
  assert.equal(remainingMs(T0, T0 + ROOM_MS + 5_000), 0)
})

test("invitation window opens late in closing and closes at resolve", () => {
  assert.equal(shouldInvite(T0, T0 + ROOM_MS * 0.9), false)
  assert.equal(shouldInvite(T0, T0 + ROOM_MS * 0.93), true)
  assert.equal(shouldInvite(T0, T0 + ROOM_MS - RESOLVE_MS), false)
})

test("first connect gets the full budget; reconnect gets the remainder", () => {
  assert.equal(maxDurationSec(undefined, T0), ROOM_MS / 1000)
  assert.equal(maxDurationSec(T0, T0 + 120_000), (ROOM_MS - 120_000) / 1000)
})

test("reconnect below the floor is refused with null", () => {
  assert.equal(maxDurationSec(T0, T0 + ROOM_MS - MIN_RECONNECT_MS + 1), null)
  assert.equal(maxDurationSec(T0, T0 + ROOM_MS + 1), null)
})

test("time-up in a verdict lane keeps today's rule: resolving or over, and the persona quiet or the floor reached", () => {
  assert.equal(shouldLandOnTime(ROOM_MS - RESOLVE_MS - 1, ROOM_MS, false), false)
  assert.equal(shouldLandOnTime(ROOM_MS - RESOLVE_MS, ROOM_MS, false), true)
  assert.equal(shouldLandOnTime(ROOM_MS - RESOLVE_MS, ROOM_MS, true), false)
  assert.equal(shouldLandOnTime(ROOM_MS - 2_000, ROOM_MS, true), true)
})

test("a cold call's time-up lets the user finish, hands the persona the last word, and lands once it is spoken", () => {
  const roomMs = 120_000
  const T = 1_000_000
  const at = (elapsed: number, rest: Partial<Parameters<typeof coldTimeUp>[0]> = {}) =>
    coldTimeUp({
      elapsed,
      roomMs,
      now: T + elapsed,
      userSpeaking: false,
      avatarSpeaking: false,
      avatarSpokeAt: null,
      lastWordAt: null,
      ...rest,
    })
  assert.equal(at(roomMs - 1, { userSpeaking: true }), "open")
  // Mid-thought at the buzzer: finish it, within the grace.
  assert.equal(at(roomMs, { userSpeaking: true }), "finish")
  assert.equal(at(roomMs + TIME_FINISH_GRACE_MS - 1, { userSpeaking: true }), "finish")
  assert.equal(at(roomMs + TIME_FINISH_GRACE_MS, { userSpeaking: true }), "handOff")
  // Quiet at the buzzer: the floor goes to the persona at once.
  assert.equal(at(roomMs), "handOff")
  // Waiting for the last word, then landing once it has been spoken.
  const handed = T + roomMs
  assert.equal(at(roomMs + 1_000, { lastWordAt: handed }), "lastWord")
  assert.equal(at(roomMs + 3_000, { lastWordAt: handed, avatarSpokeAt: handed + 1_000, avatarSpeaking: true }), "lastWord")
  assert.equal(at(roomMs + 6_000, { lastWordAt: handed, avatarSpokeAt: handed + 1_000 }), "land")
  // Speech from before the hand-off is not the last word.
  assert.equal(at(roomMs + 6_000, { lastWordAt: handed, avatarSpokeAt: handed - 1_000 }), "lastWord")
  // No reply ever: the cap lands it.
  assert.equal(at(roomMs + LAST_WORD_MAX_MS, { lastWordAt: handed }), "land")
})

test("invitations rotate by seed, name the persona, and contain no digits or em dashes", () => {
  const picks = new Set(
    Array.from({ length: INVITATIONS.length }, (_, i) => pickInvitation(i, "Marcus"))
  )
  assert.equal(picks.size, INVITATIONS.length)
  for (const line of picks) {
    assert.doesNotMatch(line, /[0-9—]/)
    // Substitution must run to completion: a literal placeholder in spoken
    // copy is the realistic regression here.
    assert.doesNotMatch(line, /\{name\}/)
  }
  const named = INVITATIONS.filter((line) => line.includes("{name}")).length
  const substituted = [...picks].filter((line) => line.includes("Marcus")).length
  assert.equal(substituted, named)
})

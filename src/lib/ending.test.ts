import test from "node:test"
import assert from "node:assert/strict"
import { endingContract, minutesPhrase, withTimeContract } from "./ending.ts"

test("contract carries the load-bearing directives", () => {
  const contract = endingContract("Marcus", 5)
  for (const marker of [
    "final question",
    "20 seconds",
    "never introduce a new",
    "debrief",
    "confirm once",
    // The early-close guards: the probing floor and the no-close-on-a-thin-
    // thread rule are what keep the model from spending a five minute room
    // in three (observed live before this contract revision).
    "at least 20 full exchanges",
    "never begin your close just because a thread has thinned",
  ]) {
    assert.ok(contract.toLowerCase().includes(marker.toLowerCase()), `missing: ${marker}`)
  }
})

test("startScript contract words the room's minutes and stays inside Runway's 2000-char limit", () => {
  // A base long enough that appending the contract would cross the cap:
  // the guard must return the base unchanged, never a truncated hybrid.
  const nearCap = "x".repeat(1_990)
  assert.equal(withTimeContract(nearCap, 5), nearCap)
  // "Up to", not a promise of the full budget: the model closes when it
  // closes, and the spoken contract must survive an early landing.
  assert.ok(withTimeContract("Welcome.", 5).includes("up to five minutes"))
  assert.ok(withTimeContract("Welcome.", 2).includes("up to two minutes"))
  assert.ok(withTimeContract("Welcome.", 1).includes("up to a minute"))
  assert.ok(withTimeContract("Welcome.", 5).length <= 2_000)
})

test("minutesPhrase reads like speech", () => {
  assert.equal(minutesPhrase(1), "a minute")
  assert.equal(minutesPhrase(2), "two minutes")
  assert.equal(minutesPhrase(5), "five minutes")
  assert.equal(minutesPhrase(7), "7 minutes")
})

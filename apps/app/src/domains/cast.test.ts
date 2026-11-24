import test from "node:test"
import assert from "node:assert/strict"
import { castOf, drawCast, drawPersona, laneFaces, resolveCounterpart } from "./cast.ts"
import type { Archetype, DomainPack, Persona } from "./types.ts"

const archetype = (id: string): Archetype => ({
  id,
  role: `${id} role`,
  shortRole: `The ${id}`,
  tone: "",
  attack: [],
  bio: "",
  tags: [],
  signature: "",
})
const persona = (id: string, archetypeId: string): Persona => ({
  id,
  archetypeId,
  name: id,
  image: `/avatars/${id}.png`,
})

// Two roles with three faces and one role with a single face.
const pack = {
  archetypes: [archetype("a"), archetype("b"), archetype("c")],
  personas: [
    persona("a-01", "a"),
    persona("a-02", "a"),
    persona("a-03", "a"),
    persona("b-01", "b"),
    persona("b-02", "b"),
    persona("b-03", "b"),
    persona("c-01", "c"),
  ],
} as unknown as DomainPack

test("castOf lists the archetype's faces in pack order", () => {
  assert.deepEqual(
    castOf(pack, "a").map((p) => p.id),
    ["a-01", "a-02", "a-03"]
  )
  assert.deepEqual(castOf(pack, "missing"), [])
})

test("resolveCounterpart joins the face to its archetype and is null for unknown ids", () => {
  const c = resolveCounterpart(pack, "b-02")
  assert.equal(c?.name, "b-02")
  assert.equal(c?.shortRole, "The b")
  assert.equal(resolveCounterpart(pack, "nope"), null)
})

test("laneFaces represents every archetype before repeating any, in cast order", () => {
  assert.deepEqual(
    laneFaces(pack, 3).map((p) => p.id),
    ["a-01", "b-01", "c-01"]
  )
  assert.deepEqual(
    laneFaces(pack, 5).map((p) => p.id),
    ["a-01", "b-01", "c-01", "a-02", "b-02"]
  )
  assert.equal(laneFaces(pack, 20).length, 7)
})

test("drawPersona excludes the last faced and is uniform over the rest", () => {
  const cast = castOf(pack, "a")
  assert.equal(drawPersona(cast, "a-01", () => 0).id, "a-02")
  assert.equal(drawPersona(cast, "a-01", () => 0.99).id, "a-03")
  assert.equal(drawPersona(cast, null, () => 0.5).id, "a-02")
})

test("drawPersona falls back to the whole cast when there is one face", () => {
  assert.equal(drawPersona(castOf(pack, "c"), "c-01", () => 0.5).id, "c-01")
})

test("drawPersona throws on an empty cast", () => {
  assert.throws(() => drawPersona([], null, () => 0))
})

test("drawCast draws one face per archetype, avoiding each archetype's last face", () => {
  const cast = drawCast(pack, { a: "a-01", b: "b-03" }, () => 0)
  assert.deepEqual(cast, { a: "a-02", b: "b-01", c: "c-01" })
})

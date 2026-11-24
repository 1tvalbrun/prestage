import type { Counterpart, DomainPack, Persona } from "./types.ts"

// Pure functions over a pack's archetypes and personas. No pack imports
// here, so the registry and Convex can both use them without a cycle.

export const castOf = (pack: DomainPack, archetypeId: string): Persona[] =>
  pack.personas.filter((persona) => persona.archetypeId === archetypeId)

export const resolveCounterpart = (pack: DomainPack, personaId: string): Counterpart | null => {
  const persona = pack.personas.find((p) => p.id === personaId)
  if (!persona) return null
  const archetype = pack.archetypes.find((a) => a.id === persona.archetypeId)
  if (!archetype) return null
  return { ...archetype, ...persona }
}

// One face from every archetype first, then round-robin across them, up to
// n. The lane chooser's discs read this so no role is ever missing.
export const laneFaces = (pack: DomainPack, n: number): Persona[] => {
  const casts = pack.archetypes.map((archetype) => castOf(pack, archetype.id))
  const longest = Math.max(0, ...casts.map((cast) => cast.length))
  const faces: Persona[] = []
  for (let i = 0; i < longest; i += 1) {
    for (const cast of casts) {
      if (cast[i]) faces.push(cast[i])
    }
  }
  return faces.slice(0, n)
}

// Uniform over the cast minus the face met most recently. A single-face
// cast has nothing to avoid. rng is injected so tests are deterministic.
export const drawPersona = (
  cast: Persona[],
  lastFacedId: string | null,
  rng: () => number
): Persona => {
  if (cast.length === 0) throw new Error("Empty cast")
  const candidates = cast.length > 1 ? cast.filter((p) => p.id !== lastFacedId) : cast
  return candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))]
}

// A practice's cast: one drawn face per archetype in the pack.
export const drawCast = (
  pack: DomainPack,
  lastFaced: Record<string, string | undefined>,
  rng: () => number
): Record<string, string> =>
  Object.fromEntries(
    pack.archetypes.map((archetype) => [
      archetype.id,
      drawPersona(castOf(pack, archetype.id), lastFaced[archetype.id] ?? null, rng).id,
    ])
  )

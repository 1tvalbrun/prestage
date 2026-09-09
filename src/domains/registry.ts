import { founderPack } from "./founder/pack.ts"
import { salesPack } from "./sales/pack.ts"
import { auditPack } from "./audit/pack.ts"
import { interviewPack } from "./interview/pack.ts"
import type {
  DomainPack,
  Persona,
  PracticeVariant,
  Scope,
  VerdictOption,
  VerdictTone,
} from "./types.ts"
import { ROOM_MS } from "../lib/roomClock.ts"

// The one list of lanes. Onboarding renders it, users.lanes validates
// against it, and every engine read resolves a pack through it.
export const PACKS: Record<string, DomainPack> = {
  [founderPack.id]: founderPack,
  [salesPack.id]: salesPack,
  [auditPack.id]: auditPack,
  [interviewPack.id]: interviewPack,
}

export const ALL_PACKS = Object.values(PACKS)

export const isPackId = (id: string): boolean => id in PACKS

export const getPack = (packId?: string): DomainPack =>
  (packId !== undefined ? PACKS[packId] : undefined) ?? founderPack

// The shape of one practice. Packs without variants get their own fields
// and copy back, so the engine can read a variant everywhere.
export const variantOf = (pack: DomainPack, scope: Scope): PracticeVariant =>
  pack.variant?.(scope) ?? {
    scopeFields: pack.scopeFields,
    prep: true,
    personaId: null,
    roomMinutes: ROOM_MS / 60_000,
    closingRead: true,
    remembers: true,
    verdicts: pack.verdicts,
    copy: {
      formSections: pack.copy.form.sections,
      preview: pack.copy.preview,
      panelLead: pack.copy.panel.lead,
    },
  }

// The one panelist a practice can face, when there is exactly one: the
// variant locks them, or the lane has a single persona.
export const lockedPersona = (pack: DomainPack, variant: PracticeVariant): Persona | null =>
  pack.personas.find((persona) => persona.id === variant.personaId) ??
  (pack.personas.length === 1 ? pack.personas[0] : null)

// Cross-lane verdict lookup for surfaces that mix practices from several
// packs (badges, session lists). Values are distinct across packs by
// convention; first match wins.
export const findVerdict = (value: string): VerdictOption | null => {
  for (const pack of ALL_PACKS) {
    const option = pack.verdicts.options.find((o) => o.value === value)
    if (option) return option
  }
  return null
}

// "Up from last time" without numbers: tones order bad < mid < good.
const TONE_RANK: Record<VerdictTone, number> = { bad: 0, mid: 1, good: 2 }

export const verdictDirection = (
  previous: string | null,
  next: string
): "up" | "down" | "same" | null => {
  if (previous === null) return null
  const prevTone = findVerdict(previous)?.tone
  const nextTone = findVerdict(next)?.tone
  if (!prevTone || !nextTone) return null
  const delta = TONE_RANK[nextTone] - TONE_RANK[prevTone]
  return delta > 0 ? "up" : delta < 0 ? "down" : "same"
}

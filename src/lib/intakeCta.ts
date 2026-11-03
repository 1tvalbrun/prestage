import type { Archetype, DomainPack, PracticeVariant } from "../domains/types.ts"

export type IntakeCta = { label: string; hint: string }

// The brief's submit button names the beat it starts. With prep that beat
// is the read, and meeting anyone comes two steps later, so the pack's
// copy speaks; without prep the counterpart step is next. The face is not
// drawn until the practice exists, so the button names the role, not a name.
export const intakeCta = (
  pack: DomainPack,
  variant: PracticeVariant,
  locked: Archetype | null
): IntakeCta => {
  if (variant.prep) return pack.prep.start
  if (!locked) return { label: "Choose your counterpart", hint: "You pick who to face next." }
  return { label: "Meet your counterpart", hint: "They know nothing about you until you speak." }
}

// The voice confirm's button folds the same beat into its "looks right".
export const confirmLabel = (cta: IntakeCta): string =>
  `Looks right, ${cta.label.charAt(0).toLowerCase()}${cta.label.slice(1)}`

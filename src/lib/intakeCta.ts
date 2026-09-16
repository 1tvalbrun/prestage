import type { DomainPack, Persona, PracticeVariant } from "../domains/types.ts"
import { firstNameOf } from "../domains/types.ts"

export type IntakeCta = { label: string; hint: string }

// The brief's submit button names the beat it starts. With prep that beat
// is the read, and meeting anyone comes two steps later, so the pack's
// copy speaks; without prep the counterpart step is next and the locked
// counterpart is who the user is about to face.
export const intakeCta = (
  pack: DomainPack,
  variant: PracticeVariant,
  counterpart: Persona | null
): IntakeCta => {
  if (variant.prep) return pack.prep.start
  if (!counterpart) return { label: "Choose your counterpart", hint: "You pick who to face next." }
  const first = firstNameOf(counterpart.name)
  return { label: `Meet ${first}`, hint: `${first} knows nothing about you until you speak.` }
}

// The voice confirm's button folds the same beat into its "looks right".
export const confirmLabel = (cta: IntakeCta): string =>
  `Looks right, ${cta.label.charAt(0).toLowerCase()}${cta.label.slice(1)}`

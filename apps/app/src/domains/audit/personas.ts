import type { Archetype, Persona } from "../types.ts"

// The audit lane's one role. An audit interview is a 1-on-1 session.
export const AUDIT_ARCHETYPES: Archetype[] = [
  {
    id: "lead_assessor",
    role: "Lead Security Assessor, 25 years across finance and SaaS",
    shortRole: "The assessor",
    tone: "Methodical and unhurried, kind but impossible to rush past, asks to see rather than hear",
    attack: [
      { text: "Runs it like the real thing. Comes for " },
      { text: "evidence and cadence", strong: true },
      { text: ": show the record, and show the last time it ran." },
    ],
    bio: 'Twenty-five years of audit interviews across finance and SaaS. Believes every control has a paper trail or it didn’t happen; warm until an answer begins with "usually".',
    tags: ["Evidence trails", "Show don't tell", "Cadence"],
    signature: "If ransomware took your production environment tonight, explain to me why it can't touch this copy.",
  },
]

export const AUDIT_CAST: Persona[] = [
  { id: "assessor-01", archetypeId: "lead_assessor", name: "Priya Nair", image: "/avatars/priya-nair.png" },
  { id: "assessor-02", archetypeId: "lead_assessor", name: "Mark Sorensen", image: "/avatars/mark-sorensen.png" },
  { id: "assessor-03", archetypeId: "lead_assessor", name: "Malcolm Pierce", image: "/avatars/malcolm-pierce.png" },
]

import type { Archetype, Persona } from "../types.ts"

// The founder lane's roles and casts. Behavior lives on the archetype; the
// face carries only name and photo. Runway avatar ids live in the Convex
// avatars registry, keyed by persona id.
export const FOUNDER_ARCHETYPES: Archetype[] = [
  {
    id: "vc",
    role: "Partner, Series A/B · Enterprise SaaS",
    shortRole: "The VC",
    tone: "Sharp, economical with words, uses silence as pressure",
    attack: [
      { text: "Will open on " },
      { text: "market size and pricing power", strong: true },
      { text: ": your TAM and why anyone pays." },
    ],
    bio: "Reviewed 2,000+ pitches, backed 23, watched 11 fail. Comes for market size, moats, pricing power and round math.",
    tags: ["Market sizing", "Defensibility", "Pricing power"],
    signature: "Walk me through the market math, bottoms-up, not the report you bought.",
  },
  {
    id: "target_customer",
    role: "Head of Strategy, Series C SaaS ($80M ARR)",
    shortRole: "The buyer",
    tone: "Blunt, buyer-brained, has been burned by overpromised tools before",
    attack: [
      { text: "Plays your real customer. Comes for " },
      { text: "switching cost and procurement", strong: true },
      { text: ": why they'd rip out what they already have." },
    ],
    bio: "Plays your real customer. Asks what it replaces, what switching costs, and what happens when it breaks at 11pm.",
    tags: ["Buying process", "Switching cost", "Procurement"],
    signature: "Why would I rip out something that already works for this?",
  },
  {
    id: "technical_architect",
    role: "Principal Engineer, ML Infrastructure",
    shortRole: "The architect",
    tone: "Methodical, surfaces assumptions others don't see, constructive not combative",
    attack: [
      { text: "Thinks in failure modes. Goes straight at " },
      { text: "feasibility and reliability", strong: true },
      { text: ": accuracy claims, latency, and what breaks first." },
    ],
    bio: 'Thinks in failure modes. Flags accuracy claims with no methodology and "optimize later" in the critical path.',
    tags: ["Latency", "Reliability", "Build vs buy"],
    signature: "You said it's accurate. Show me how you measured that.",
  },
]

export const FOUNDER_CAST: Persona[] = [
  { id: "vc-01", archetypeId: "vc", name: "Victoria Chen", image: "/avatars/victoria-chen.png" },
  { id: "vc-02", archetypeId: "vc", name: "Andrew Caldwell", image: "/avatars/andrew-caldwell.png" },
  { id: "vc-03", archetypeId: "vc", name: "Daniel Osei", image: "/avatars/daniel-osei.png" },
  { id: "tc-01", archetypeId: "target_customer", name: "Marcus Rivera", image: "/avatars/marcus-rivera.png" },
  { id: "tc-02", archetypeId: "target_customer", name: "Megan Sullivan", image: "/avatars/megan-sullivan.png" },
  { id: "tc-03", archetypeId: "target_customer", name: "Angela Whitfield", image: "/avatars/angela-whitfield.png" },
  { id: "ta-01", archetypeId: "technical_architect", name: "Dr. Sarah Okafor", image: "/avatars/sarah-okafor.png" },
  { id: "ta-02", archetypeId: "technical_architect", name: "Erik Larsen", image: "/avatars/erik-larsen.png" },
  { id: "ta-03", archetypeId: "technical_architect", name: "Arjun Mehta", image: "/avatars/arjun-mehta.png" },
]

import type { Archetype, Persona } from "../types.ts"

// The interview lane's three roles, specialized by interview format, not
// domain. Formats are few and stable; domains are infinite.
export const INTERVIEW_ARCHETYPES: Archetype[] = [
  {
    id: "recruiter_screen",
    role: "Recruiter, first-round screen",
    shortRole: "The screener",
    tone: "Fast, warm, efficient; listens for motivation, a coherent career story, and the fit questions a resume can't answer",
    attack: [
      { text: "Runs the thirty-minute screen. Comes for " },
      { text: "your story and your why", strong: true },
      { text: ": what you did, why you're leaving, and whether it holds together at pace." },
    ],
    bio: "Screens hundreds of candidates a year and decides in minutes who moves forward. Friendly on the surface, ruthless about vagueness — a rambling answer is its own red flag.",
    tags: ["Motivation", "Career story", "Fit"],
    signature:
      "Walk me through the last few years in about a minute — and what you're looking for next.",
  },
  {
    id: "hiring_manager",
    role: "Hiring manager, behavioral loop",
    shortRole: "The hiring manager",
    tone: "Steady and probing, goes three levels deep on every story; allergic to a 'we' that hides what you actually did",
    attack: [
      { text: "Owns the team you'd join. Comes for " },
      { text: "ownership and conflict", strong: true },
      { text: ": real stories, your actual role in them, and what you'd do differently." },
    ],
    bio: "Has hired and managed through enough cycles to know rehearsed answers on sight. Asks for one story, then follows it down until the real decisions and the real mistakes show.",
    tags: ["Ownership", "Conflict", "Behavioral depth"],
    signature: "Tell me about a time this went wrong — and what you did about it.",
  },
  {
    id: "domain_practitioner",
    role: "Senior practitioner, domain deep-dive",
    shortRole: "The practitioner",
    tone: "Knowledgeable and scenario-driven; presses why-chains and trade-offs until the reasoning either holds or runs out",
    attack: [
      { text: "Does the job you're interviewing for. Comes for " },
      { text: "scenarios and trade-offs", strong: true },
      { text: ": concrete situations, your reasoning under pressure, and the why behind each call." },
    ],
    bio: "The interviewer who's done the work. Doesn't quiz on trivia — puts you in a situation from the role and keeps asking why until it's clear whether you've actually been there.",
    tags: ["Technical depth", "Trade-offs", "Scenarios"],
    signature: "Let's get concrete. Walk me through exactly how you'd handle this one.",
  },
]

export const INTERVIEW_CAST: Persona[] = [
  { id: "screener-01", archetypeId: "recruiter_screen", name: "Jun Park", image: "/avatars/jun-park.png" },
  { id: "screener-02", archetypeId: "recruiter_screen", name: "Emily Hartman", image: "/avatars/emily-hartman.png" },
  { id: "screener-03", archetypeId: "recruiter_screen", name: "Camila Duarte", image: "/avatars/camila-duarte.png" },
  { id: "hm-01", archetypeId: "hiring_manager", name: "Renee Calloway", image: "/avatars/renee-calloway.png" },
  { id: "hm-02", archetypeId: "hiring_manager", name: "Tom Hendricks", image: "/avatars/tom-hendricks.png" },
  { id: "hm-03", archetypeId: "hiring_manager", name: "Valeria Castillo", image: "/avatars/valeria-castillo.png" },
  { id: "practitioner-01", archetypeId: "domain_practitioner", name: "Tomás Reyes", image: "/avatars/tomas-reyes.png" },
  { id: "practitioner-02", archetypeId: "domain_practitioner", name: "Ryan Mitchell", image: "/avatars/ryan-mitchell.png" },
  { id: "practitioner-03", archetypeId: "domain_practitioner", name: "Anjali Desai", image: "/avatars/anjali-desai.png" },
]

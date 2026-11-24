import type { Archetype, Persona } from "../types.ts"

// The sales lane's two roles, one per call type. A pitch meeting is a
// 1-on-1 with the operator who owns the process you're asking them to
// change; a cold call is a 1-on-1 with someone who never asked to hear
// from you.
export const SALES_ARCHETYPES: Archetype[] = [
  {
    id: "operator_buyer",
    role: "Owns the process you're asking them to change",
    shortRole: "The buyer",
    tone: "Warm but immovable, guards the team's time, has sat through a hundred vendor pitches",
    attack: [
      { text: "Owns the process you want to change. Comes for " },
      { text: "switching cost and proof", strong: true },
      { text: ": what breaks, who pays, and what happens at month three." },
    ],
    bio: "Plays whoever you're pitching, from the inside of that operation. Has bought a dozen tools that worked and ripped out three that didn't. Likes ideas fine; buys outcomes, references, and a next step worth the calendar slot.",
    tags: ["Switching cost", "ROI proof", "Next steps"],
    signature: "I've sat through a hundred vendor pitches. Show me the one thing that makes yours worth a next step.",
  },
  {
    id: "cold_prospect",
    role: "Owner-operator, small local business",
    shortRole: "The cold call",
    tone: "Busy, polite, distracted at first, spots a sales call in the first breath",
    attack: [
      { text: "Never asked to hear from you. Comes for " },
      { text: "why you're calling and why now", strong: true },
      { text: ": you get thirty seconds, then they decide." },
    ],
    bio: "Picked up because it might have been a customer. Knows nothing about you or what you sell, has a hundred unexpected calls behind them, and gives every one a fair thirty seconds.",
    tags: ["The opener", "Brush-offs", "The small ask"],
    signature: "Yeah, what's this about?",
  },
]

export const SALES_CAST: Persona[] = [
  { id: "buyer-01", archetypeId: "operator_buyer", name: "Cole Merritt", image: "/avatars/cole-merritt.png" },
  { id: "buyer-02", archetypeId: "operator_buyer", name: "Denise Jackson", image: "/avatars/denise-jackson.png" },
  { id: "buyer-03", archetypeId: "operator_buyer", name: "Omar Nasser", image: "/avatars/omar-nasser.png" },
  { id: "prospect-01", archetypeId: "cold_prospect", name: "Greg Hollis", image: "/avatars/greg-hollis.png" },
  { id: "prospect-02", archetypeId: "cold_prospect", name: "Luis Ortega", image: "/avatars/luis-ortega.png" },
  { id: "prospect-03", archetypeId: "cold_prospect", name: "Tammy Nguyen", image: "/avatars/tammy-nguyen.png" },
]

import type { Persona } from "../types.ts"

// The sales lane's buyers, one per call type. A pitch meeting is a 1-on-1
// with the operator who owns the process you're asking them to change; a
// cold call is a 1-on-1 with someone who never asked to hear from you. The
// Runway avatar ids live in the Convex avatars registry.
export const BUYER_PERSONAS: Persona[] = [
  {
    id: "buyer-01",
    archetypeId: "operator_buyer",
    name: "Cole Merritt",
    role: "Owns the process you're asking them to change",
    shortRole: "The buyer",
    tone: "Warm but immovable, guards the team's time, has sat through a hundred vendor pitches",
    image: "/avatars/cole-merritt.png",
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
    id: "prospect-01",
    archetypeId: "cold_prospect",
    name: "Greg Hollis",
    role: "Owner-operator, small local business",
    shortRole: "The cold call",
    tone: "Busy, polite, distracted at first, spots a sales call in the first breath",
    image: "/avatars/greg-hollis.png",
    attack: [
      { text: "Never asked to hear from you. Comes for " },
      { text: "why you're calling and why now", strong: true },
      { text: ": you get thirty seconds, then he decides." },
    ],
    bio: "Picked up because it might have been a customer. Knows nothing about you or what you sell, has a hundred unexpected calls behind him, and gives every one a fair thirty seconds.",
    tags: ["The opener", "Brush-offs", "The small ask"],
    signature: "Yeah, this is Greg. What's this about?",
  },
]

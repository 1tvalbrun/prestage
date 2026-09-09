import type { DomainPack, Scope } from "../domains/types.ts"
import { variantOf } from "../domains/registry.ts"

export type FlowStage = "brief" | "read" | "audit" | "panel" | "room"
export type FlowStep = { label: string; keys: FlowStage[] }

// The progress rail. The middle beat's name comes from the lane, and a
// practice without prep has no middle beat at all. Null pack = the frame
// before the practice loads, which assumes the common shape.
export const flowSteps = (pack: DomainPack | null, scope: Scope): FlowStep[] => {
  const prep: FlowStep[] =
    pack && !variantOf(pack, scope).prep
      ? []
      : [{ label: pack?.prep.stepLabel ?? "Pre-read", keys: ["read", "audit"] }]
  return [
    { label: "Brief", keys: ["brief"] },
    ...prep,
    { label: "Panel", keys: ["panel"] },
    { label: "Room", keys: ["room"] },
  ]
}

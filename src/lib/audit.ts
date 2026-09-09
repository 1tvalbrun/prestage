import { v, type Infer } from "convex/values"

// Single source for the audit contract: the schema table, the Convex
// mutations, and the TS types all derive from these validators.
export const citationValidator = v.object({
  source: v.string(),
  location: v.string(),
})

// A claim without a citation cannot be constructed — grounding is the type.
export const claimValidator = v.object({
  text: v.string(),
  citation: citationValidator,
})

export const gapValidator = v.object({
  severity: v.union(v.literal("blocker"), v.literal("gap")),
  kind: v.union(v.literal("absent"), v.literal("unsupported")),
  title: v.string(),
  detail: v.string(),
})

export type Citation = Infer<typeof citationValidator>
export type Claim = Infer<typeof claimValidator>
export type Gap = Infer<typeof gapValidator>

export type AuditResult = {
  claims: Claim[]
  gaps: Gap[]
  // Previous gaps the latest materials resolved (a re-run only).
  closed: Gap[]
}

export const MAX_CLAIMS = 15
export const MAX_GAPS = 10

const normalize = (value: string) => value.trim().toLowerCase()

// 4a's extraction markers are the citable surface of each material.
// A material with no markers (DOCX) is citable as one "document".
export const locationsIn = (materialText: string): Set<string> => {
  const markers = [...materialText.matchAll(/\[(page \d+|slide \d+|sheet [^\]]+)\]/gi)].map(
    (match) => normalize(match[1])
  )
  return new Set(markers.length > 0 ? markers : ["document"])
}

type GroundingMaterial = { name: string; text: string }

export const field = (entry: unknown, key: string): unknown =>
  typeof entry === "object" && entry !== null
    ? (entry as Record<string, unknown>)[key]
    : undefined

export const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null

const parseSeverity = (value: string | undefined): Gap["severity"] =>
  value === "blocker" ? "blocker" : "gap"

const parseKind = (value: string | undefined): Gap["kind"] =>
  value === "unsupported" ? "unsupported" : "absent"

// The re-run's third task: the previous gaps by title, and which of them
// the materials now answer. Empty when there is nothing to resolve, so a
// first run's prompt is unchanged.
export const previousGapsTask = (previousGaps: Gap[] | undefined): string =>
  previousGaps && previousGaps.length > 0
    ? `\n\nTASK 3 — RESOLVED. These gaps were found on an earlier read of fewer materials:\n${previousGaps
        .map((gap) => `- ${gap.title}`)
        .join(
          "\n"
        )}\nFor each, decide from the materials above whether it is now answered. Return the titles of the resolved ones under "resolved", copied exactly; leave the rest out. Do not list a resolved gap under "gaps" again.`
    : ""

export const resolvedContract = (previousGaps: Gap[] | undefined): string =>
  previousGaps && previousGaps.length > 0 ? ',"resolved":["exact title"]' : ""

// Validates model output against the actual materials. Claims that cite a
// real source and location survive; everything else is demoted to an
// "unsupported" gap. The model cannot assert what it cannot cite. Resolved
// gaps are drawn from our own previous list by exact title, so the model
// can only close what we asked about.
export const groundAudit = (
  raw: { claims?: unknown; gaps?: unknown; resolved?: unknown },
  materials: GroundingMaterial[],
  previousGaps: Gap[] = []
): AuditResult => {
  const sources = new Map(
    materials.map((material) => [normalize(material.name), locationsIn(material.text)])
  )
  const resolvedTitles = new Set(
    (Array.isArray(raw.resolved) ? raw.resolved : [])
      .map((entry: unknown) => asString(entry))
      .flatMap((title) => (title ? [normalize(title)] : []))
  )
  const closed = previousGaps.filter((gap) => resolvedTitles.has(normalize(gap.title)))
  const closedTitles = new Set(closed.map((gap) => normalize(gap.title)))

  const claims: Claim[] = []
  const gaps: Gap[] = []

  const rawClaims: unknown[] = Array.isArray(raw.claims) ? raw.claims.slice(0, MAX_CLAIMS) : []
  for (const entry of rawClaims) {
    const text = asString(field(entry, "text"))
    if (!text) continue
    const source = asString(field(entry, "source"))
    const location = asString(field(entry, "location"))
    if (
      source !== null &&
      location !== null &&
      sources.get(normalize(source))?.has(normalize(location))
    ) {
      claims.push({ text, citation: { source, location } })
    } else {
      gaps.push({
        severity: "gap",
        kind: "unsupported",
        title: text,
        detail: "Stated, but nothing in the materials backs it.",
      })
    }
  }

  const rawGaps: unknown[] = Array.isArray(raw.gaps) ? raw.gaps : []
  for (const entry of rawGaps) {
    if (gaps.length >= MAX_GAPS) break
    const title = asString(field(entry, "title"))
    if (!title || closedTitles.has(normalize(title))) continue
    gaps.push({
      severity: parseSeverity(asString(field(entry, "severity"))?.toLowerCase()),
      kind: parseKind(asString(field(entry, "kind"))?.toLowerCase()),
      title,
      detail: asString(field(entry, "detail")) ?? "",
    })
  }

  return { claims, gaps: gaps.slice(0, MAX_GAPS), closed }
}

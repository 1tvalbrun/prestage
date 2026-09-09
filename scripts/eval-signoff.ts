import { readFileSync } from "node:fs"
import { SIGN_OFF_PROMPT, renderWindow, resolveSignOff, signOffLines } from "../src/lib/signOff.ts"
import { createOpenAI, modelSettings } from "../src/lib/openai.ts"

// Offline evaluation of the sign-off check against labeled windows across
// every lane. Spends real credit (one fast call per fixture); run it after
// any prompt change, never as part of the unit suite:
//   pnpm eval:signoff
// The bar: no "none" window classified as a sign-off above 1 percent, and
// sign-offs caught at 95 percent or better.

type Label = "user" | "panelist" | "both" | "none"
type Fixture = { lane: string; label: Label; turns: { type: "user" | "panelist"; text: string }[] }

const fixtures: Fixture[] = JSON.parse(
  readFileSync(new URL("./fixtures/signoff.json", import.meta.url), "utf8")
)
const openai = await createOpenAI()
const settings = modelSettings("fast")

const counts: Record<string, { tp: number; fp: number; fn: number }> = {}
const bump = (label: string, key: "tp" | "fp" | "fn") => {
  counts[label] ??= { tp: 0, fp: 0, fn: 0 }
  counts[label][key] += 1
}

let falseEndings = 0
let signOffsCaught = 0
for (const fixture of fixtures) {
  const turns = fixture.turns.map((turn, i) => ({ ...turn, timestamp: i * 1_000 }))
  const lines = signOffLines(turns, undefined, undefined)
  const response = await openai.chat.completions.create({
    ...settings,
    messages: [
      { role: "system", content: SIGN_OFF_PROMPT },
      { role: "user", content: renderWindow(lines) },
    ],
    response_format: { type: "json_object" },
  })
  const flagged: number[] = JSON.parse(response.choices[0]?.message?.content ?? "{}").signOffLines ?? []
  const answer: string = resolveSignOff(lines, flagged) ?? "none"
  if (fixture.label !== "none" && answer !== "none") signOffsCaught += 1
  if (answer === fixture.label) {
    bump(fixture.label, "tp")
    continue
  }
  bump(fixture.label, "fn")
  bump(answer, "fp")
  if (fixture.label === "none" && answer !== "none") falseEndings += 1
  console.log(
    `MISS [${fixture.lane}] expected ${fixture.label}, got ${answer}\n${fixture.turns
      .map((turn) => `  ${turn.type}: ${turn.text}`)
      .join("\n")}\n`
  )
}

for (const [label, c] of Object.entries(counts)) {
  const precision = c.tp + c.fp === 0 ? 1 : c.tp / (c.tp + c.fp)
  const recall = c.tp + c.fn === 0 ? 1 : c.tp / (c.tp + c.fn)
  console.log(
    `${label.padEnd(9)} precision ${(precision * 100).toFixed(1)}%  recall ${(recall * 100).toFixed(1)}%  (n=${c.tp + c.fn})`
  )
}
const noneTotal = fixtures.filter((fixture) => fixture.label === "none").length
const signOffTotal = fixtures.length - noneTotal
console.log(
  `sign-offs caught (any party): ${signOffsCaught}/${signOffTotal} (${((signOffsCaught / Math.max(signOffTotal, 1)) * 100).toFixed(1)}%)`
)
console.log(
  `false endings: ${falseEndings}/${noneTotal} (${((falseEndings / Math.max(noneTotal, 1)) * 100).toFixed(1)}%), model ${settings.model}`
)

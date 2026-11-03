// Pushes each role's personality to every face's Runway Character.
//   pnpm cast:push --dry-run   shows what would change, writes nothing
//   pnpm cast:push             updates every Character whose text differs
// Reads RUNWAYML_API_SECRET from .env.local (node --env-file).
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { parseCastTable, parseIdTable, parsePersonalities } from "../src/lib/castDocs.ts"

const API = "https://api.dev.runwayml.com"
const VERSION = "2024-11-06"
const CAST_DIR = path.join(process.cwd(), "docs/cast")
const dryRun = process.argv.includes("--dry-run")

const apiKey = process.env.RUNWAYML_API_SECRET
if (!apiKey) {
  console.error("RUNWAYML_API_SECRET is not set")
  process.exit(1)
}
const headers = {
  Authorization: `Bearer ${apiKey}`,
  "X-Runway-Version": VERSION,
  "Content-Type": "application/json",
}

const readme = await readFile(path.join(CAST_DIR, "README.md"), "utf8")
const faces = parseCastTable(readme)
const ids = parseIdTable(readme)

const personalities = new Map<string, string>()
for (const file of await readdir(path.join(CAST_DIR, "personalities"))) {
  const lane = path.basename(file, ".md")
  const markdown = await readFile(path.join(CAST_DIR, "personalities", file), "utf8")
  for (const { role, body } of parsePersonalities(markdown)) personalities.set(`${lane}|${role}`, body)
}

let changed = 0
for (const face of faces) {
  const id = ids[face.name]
  const template = personalities.get(`${face.lane}|${face.role}`)
  if (!id || !template) {
    console.error(`skip ${face.name}: ${id ? "no personality for" : "no Runway id for"} ${face.lane} / ${face.role}`)
    continue
  }
  const wanted = template.replaceAll("{{name}}", face.name)
  let stored: string
  try {
    const current = await fetch(`${API}/v1/avatars/${id}`, { headers })
    if (!current.ok) {
      console.error(`skip ${face.name}: GET ${current.status}`)
      continue
    }
    stored = ((await current.json()) as { personality?: string }).personality ?? ""
  } catch (error) {
    console.error(`skip ${face.name}: GET failed: ${(error as Error).message}`)
    continue
  }
  if (stored === wanted) {
    console.log(`same  ${face.name}`)
    continue
  }
  changed += 1
  console.log(`${dryRun ? "would" : "push "} ${face.name} (${stored.length} → ${wanted.length} chars)`)
  if (dryRun) continue
  try {
    const updated = await fetch(`${API}/v1/avatars/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ personality: wanted }),
    })
    if (!updated.ok) console.error(`fail  ${face.name}: PATCH ${updated.status}`)
  } catch (error) {
    console.error(`fail  ${face.name}: PATCH failed: ${(error as Error).message}`)
  }
}
console.log(`${changed} of ${faces.length} differ${dryRun ? " (dry run, nothing written)" : ""}`)

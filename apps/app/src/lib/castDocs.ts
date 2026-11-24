// Parsers for docs/cast: the lane personality files and the README tables.
// Kept out of the script so they can be tested without the network.

export const parsePersonalities = (markdown: string): { role: string; body: string }[] =>
  markdown
    .split(/^## /m)
    .slice(1)
    .map((section) => {
      const newline = section.indexOf("\n")
      return { role: section.slice(0, newline).trim(), body: section.slice(newline + 1).trim() }
    })

const tableRows = (markdown: string, firstHeader: string): string[][] =>
  markdown
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith(`| ${firstHeader} `) && !line.startsWith("|---"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))

export const parseCastTable = (readme: string): { lane: string; role: string; name: string }[] =>
  tableRows(readme.split("## Runway Character ids")[0], "Lane").map(([lane, role, name]) => ({
    lane,
    role,
    name,
  }))

export const parseIdTable = (readme: string): Record<string, string> =>
  Object.fromEntries(
    tableRows(readme.split("## Runway Character ids")[1] ?? "", "Slug").map(([, name, id]) => [name, id])
  )

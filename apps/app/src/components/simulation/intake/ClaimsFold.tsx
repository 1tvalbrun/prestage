"use client"

import { useId, useState } from "react"
import { ChevronDown } from "lucide-react"
import type { Claim } from "@/lib/audit"
import { cn } from "@/lib/utils"

type ClaimGroup = { source: string; claims: Claim[] }

// One group per cited document, in first-citation order, so a re-run's
// new document lands after the originals rather than shuffling them.
const groupBySource = (claims: Claim[]): ClaimGroup[] => {
  const groups: ClaimGroup[] = []
  for (const claim of claims) {
    const group = groups.find((entry) => entry.source === claim.citation.source)
    if (group) {
      group.claims.push(claim)
      continue
    }
    groups.push({ source: claim.citation.source, claims: [claim] })
  }
  return groups
}

type ClaimsFoldProps = {
  claims: Claim[]
}

// The claims are the audit's receipt: open by default so the read shows
// its work, closable for the user who only wants the gap map. Toggling
// grows or shrinks the card in place and moves the gap map with it;
// nothing overlays anything.
export const ClaimsFold = ({ claims }: ClaimsFoldProps) => {
  const [expanded, setExpanded] = useState(true)
  const bodyId = useId()
  const groups = groupBySource(claims)

  const handleToggle = () => setExpanded((prev) => !prev)

  return (
    <section
      aria-label="Claims extracted"
      className="rounded-xl border border-line bg-surface-raised shadow-card"
    >
      <div className="flex items-center gap-3.5 px-5 py-3.5 max-md:flex-wrap">
        <span className="flex-none rounded-full border border-line-2 bg-surface-2 px-2 py-[2px] font-mono text-[9px] font-semibold uppercase tracking-[.08em] text-on-surface-2">
          {claims.length} claim{claims.length === 1 ? "" : "s"}
        </span>
        <p className="min-w-0 flex-1 text-[13.5px] text-on-surface-2">
          Cited across {groups.length} document{groups.length === 1 ? "" : "s"}.
        </p>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={handleToggle}
          className="focus-ring -mr-1.5 flex flex-none items-center gap-1.5 rounded-lg px-1.5 py-1 text-[12.5px] font-medium text-on-surface-2 transition-colors hover:text-on-surface"
        >
          {expanded ? "Hide claims" : "Show claims"}
          <ChevronDown
            className={cn(
              "size-3.5 text-on-surface-3 transition-transform duration-300 ease-in-out motion-reduce:transition-none",
              expanded && "rotate-180"
            )}
          />
        </button>
      </div>
      <div
        id={bodyId}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden" inert={!expanded || undefined}>
          <div
            className={cn(
              "grid gap-x-6 gap-y-5 border-t border-line px-5 pb-5 pt-4",
              groups.length > 1 && "md:grid-cols-2"
            )}
          >
            {groups.map((group) => (
              <div key={group.source} className="min-w-0">
                <h3 className="flex items-baseline justify-between gap-3 font-mono text-[10px] uppercase tracking-[.05em] text-on-surface-2">
                  <span className="min-w-0 truncate">{group.source}</span>
                  <span className="flex-none normal-case tracking-normal text-ink-4">
                    {group.claims.length} cited
                  </span>
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {group.claims.map((claim, i) => (
                    <li
                      key={i}
                      className="flex items-baseline gap-2 text-[12.5px] leading-[1.45]"
                    >
                      <span aria-hidden="true" className="flex-none font-mono text-ok">✓</span>
                      <span className="sr-only">Cited claim: </span>
                      <span className="min-w-0">
                        {claim.text}
                        <span className="ml-1.5 whitespace-nowrap font-mono text-[10px] text-ink-4">
                          {claim.citation.location}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

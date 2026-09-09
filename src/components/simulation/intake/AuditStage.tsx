"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Check, Upload } from "lucide-react"
import { useAction, useMutation, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import type { Gap } from "@/lib/audit"
import { MAX_MATERIALS_PER_PRACTICE, materialsRemaining } from "@/lib/materials"
import { getPack } from "@/domains/registry"
import { scopeText } from "@/domains/types"
import { cn } from "@/lib/utils"
import { StageKicker } from "@/components/simulation/flow/FlowShell"
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/shared/buttons"
import { WaitingScreen } from "@/components/simulation/flow/WaitingScreen"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"
import { UploadList, useMaterialUploads } from "./materialUploads"
import { ClaimsFold } from "./ClaimsFold"

const KIND_LABELS: Record<Gap["kind"], string> = {
  absent: "Not found in any material",
  unsupported: "Stated without backing",
}

// Uniform cards: severity speaks through the pill tint and sort order,
// never through alarm styling — same construction as the verdict badges
// and priority tags everywhere else.
const SEVERITY_PILL: Record<Gap["severity"], string> = {
  blocker: "border-red-fg/25 bg-red-fg/10 text-red-fg",
  gap: "border-warn-line bg-warn-bg text-warn",
}

const GapCard = ({ gap }: { gap: Gap }) => (
  <li className="rounded-xl border border-line bg-surface-raised p-4 shadow-card">
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex-none rounded-full border px-2 py-[2px] font-mono text-[9px] font-semibold uppercase tracking-[.08em]",
          SEVERITY_PILL[gap.severity]
        )}
      >
        {gap.severity}
      </span>
      <p className="text-[14px] font-semibold leading-[1.4]">{gap.title}</p>
    </div>
    <p className="mt-2 text-[13px] leading-normal text-on-surface-2">{gap.detail}</p>
    <p className="mt-2.5 font-mono text-[9.5px] uppercase tracking-[.08em] text-ink-4">
      {KIND_LABELS[gap.kind]}
    </p>
  </li>
)

const MATERIAL_STATUS: Record<"extracting" | "ready" | "failed", string> = {
  extracting: "Reading",
  ready: "Read",
  failed: "Couldn't read",
}

type AuditStageProps = {
  simulationId: string
}

export const AuditStage = ({ simulationId }: AuditStageProps) => {
  const typedId = simulationId as Id<"practices">
  const practice = useQuery(api.practices.get, { id: typedId })
  const materials = useQuery(api.materials.listByPractice, { practiceId: typedId })
  const runAudit = useAction(api.practices.runAudit)
  const attachMaterials = useMutation(api.practices.attachMaterials)
  const uploads = useMaterialUploads(practice?.packId ?? "")
  const [startFailed, setStartFailed] = useState(false)
  const [attaching, setAttaching] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const autoStartedRef = useRef(false)

  const handleRunAudit = () => {
    setStartFailed(false)
    runAudit({ id: typedId }).catch(() => setStartFailed(true))
  }

  const handleAttach = async () => {
    if (attaching) return
    setAttaching(true)
    setAttachError(null)
    try {
      await attachMaterials({ practiceId: typedId, uploads: uploads.readyMaterials })
      uploads.clear()
    } catch {
      setAttachError("Couldn't add those files. Check your connection and try again.")
    } finally {
      setAttaching(false)
    }
  }

  // Auto-start on first entry: the user just asked for the read, so the
  // audit shouldn't sit behind a button. The ref stops re-render double-fires;
  // the server's idempotent start collapses refreshes and concurrent triggers.
  useEffect(() => {
    if (!practice || practice.audit || autoStartedRef.current) return
    autoStartedRef.current = true
    runAudit({ id: typedId }).catch(() => setStartFailed(true))
  }, [practice, runAudit, typedId])

  if (practice === undefined || materials === undefined) return null
  if (practice === null) return <IdeaNotFound />
  const pack = getPack(practice.packId)
  const prep = pack.prep
  if (prep.kind !== "audit") return null
  const copy = prep.copy
  if (!practice.context) {
    return (
      <p className="text-[13.5px] text-on-surface-2">
        Your brief hasn&apos;t been read yet.{" "}
        <Link
          href={`/simulation/${simulationId}/analyze`}
          className="focus-ring underline hover:text-accent-blue"
        >
          Back to the read
        </Link>
        .
      </p>
    )
  }

  const audit = practice.audit
  if (!audit || audit.status === "failed" || audit.status === "running") {
    const failed = audit?.status === "failed" || startFailed
    return (
      <div>
        {failed ? (
          <>
            <StageKicker>{copy.kicker}</StageKicker>
            <h1 className="max-w-[24ch] text-[25px] font-semibold leading-[1.2] tracking-[-.02em]">
              The audit hit a wall.
            </h1>
            <p role="alert" className="mt-3 max-w-[52ch] text-[13.5px] text-red-fg">
              {audit?.status === "failed"
                ? (audit.failureReason ?? "Something went wrong.")
                : "Couldn't start the audit. Check your connection and try again."}
            </p>
            <div className="mt-6">
              <button type="button" onClick={handleRunAudit} className={BTN_PRIMARY}>
                Retry the audit <span aria-hidden="true">→</span>
              </button>
            </div>
          </>
        ) : (
          <WaitingScreen
            kicker={prep.wait.kicker}
            heading={prep.wait.heading(scopeText(practice.scope, pack.subjectField))}
            lead={prep.wait.lead}
            rows={prep.wait.rows}
            work={prep.wait.work}
            ticker={prep.wait.ticker}
            stepMs={prep.wait.stepMs}
          />
        )}
      </div>
    )
  }

  const blockers = audit.gaps.filter((gap) => gap.severity === "blocker")
  const plainGaps = audit.gaps.length - blockers.length
  const sortedGaps = [...audit.gaps].sort(
    (a, b) => (a.severity === "blocker" ? 0 : 1) - (b.severity === "blocker" ? 0 : 1)
  )
  const closed = audit.closed ?? []
  const reading = materials.some((material) => material.status === "extracting")
  const remaining = materialsRemaining(materials.length)
  const canAttach =
    !attaching && !reading && uploads.readyMaterials.length > 0 && uploads.readyMaterials.length <= remaining

  return (
    <div>
      <StageKicker>{copy.kicker}</StageKicker>
      <h1 className="max-w-[24ch] text-[25px] font-semibold leading-[1.2] tracking-[-.02em]">
        {copy.readyHeading}
      </h1>
      <p className="mb-8 mt-2.5 max-w-[52ch] text-[14.5px] leading-relaxed text-on-surface-2">
        {copy.readyLead}
      </p>

      {/* The finding on the left, the ledger on the right: what the read
          closed and what it read. The rail is the same on a first run and
          a re-run; only the closed card comes and goes. Below lg the rail
          stacks under the gap map. */}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          {audit.claims.length === 0 ? (
            // The one clay accent on the page: the finding.
            <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-xl border border-line border-l-[3px] border-l-red-fg bg-surface-raised px-5 py-4 shadow-card">
              <span className="font-serif text-[19px] font-semibold text-red-fg">
                0 claims cited
              </span>
              <span className="text-[13.5px] leading-relaxed text-on-surface-2">
                {copy.zeroClaims}
              </span>
            </p>
          ) : (
            <ClaimsFold claims={audit.claims} />
          )}

          <section aria-label="The gap map">
            <h2 className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
              <span>The gap map</span>
              {(audit.gaps.length > 0 || closed.length > 0) && (
                <span className="font-mono text-[10.5px] normal-case tracking-[.02em]">
                  <b className="font-medium text-on-surface-2">
                    {blockers.length} blocker{blockers.length === 1 ? "" : "s"} · {plainGaps} gap
                    {plainGaps === 1 ? "" : "s"}
                    {closed.length > 0 && ` · ${closed.length} closed`}
                  </b>
                  {blockers[0] && (
                    <span className="text-ink-4"> · weakest: {blockers[0].title.toLowerCase()}</span>
                  )}
                </span>
              )}
            </h2>
            {audit.gaps.length === 0 ? (
              <p className="text-[13px] leading-normal text-on-surface-2">No open gaps found.</p>
            ) : (
              <ul className="space-y-3.5">
                {sortedGaps.map((gap, i) => (
                  <GapCard key={i} gap={gap} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          {closed.length > 0 && (
            <section
              aria-labelledby="closed-heading"
              className="rounded-xl border border-line bg-surface-raised px-[18px] py-4 shadow-card"
            >
              <h2
                id="closed-heading"
                className="flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3"
              >
                <span>Closed</span>
                <span className="rounded-full border border-ok/30 bg-ok-bg px-2 py-[2px] font-mono text-[9px] font-semibold tracking-[.08em] text-ok-fg">
                  {closed.length}
                </span>
              </h2>
              <p className="mt-1.5 text-[12px] text-on-surface-3">By what you added</p>
              <ul className="mt-2.5 space-y-2">
                {closed.map((gap, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[12.5px] leading-[1.4] text-on-surface-2"
                  >
                    <Check className="mt-px size-4 flex-none text-ok" strokeWidth={2.2} />
                    <span>{gap.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section
            aria-labelledby="materials-heading"
            className="rounded-xl border border-line bg-surface-raised px-5 py-4 shadow-card"
          >
            <h2
              id="materials-heading"
              className="flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3"
            >
              <span>Materials</span>
              <span className="font-mono text-[10.5px] tracking-[.02em]">
                {materials.length} of {MAX_MATERIALS_PER_PRACTICE}
              </span>
            </h2>
            {materials.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-[13px]">
                {materials.map((material) => (
                  <li key={material.materialId} className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1 truncate">{material.name}</span>
                    <span
                      className={cn(
                        "flex-none font-mono text-[10px] uppercase tracking-[.05em]",
                        material.status === "failed" ? "text-red-fg" : "text-on-surface-3"
                      )}
                    >
                      {MATERIAL_STATUS[material.status]}
                      {material.failureReason && `: ${material.failureReason}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {remaining === 0 ? (
              <p className="mt-3 text-[12.5px] text-on-surface-3">
                This practice holds all {MAX_MATERIALS_PER_PRACTICE} materials it can. Start a new
                practice for a different set.
              </p>
            ) : (
              <>
                {/* The input covers the label instead of hiding off-canvas:
                    when the file dialog closes, focus lands on a box that is
                    already in view, so the stage never scrolls to reach it.
                    The label carries the focus ring on the input's behalf. */}
                <label className="relative mt-3 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-line-2 bg-surface px-4 py-2.5 text-center text-[13px] font-medium text-on-surface-2 transition-colors hover:border-accent-line hover:bg-surface-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring">
                  <Upload className="size-[15px] flex-none" />
                  Add a document. The audit re-runs on everything.
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.pptx,.xlsx,.docx"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(event) => {
                      uploads.addFiles(event.target.files)
                      event.target.value = ""
                    }}
                  />
                </label>
                <UploadList uploads={uploads.uploads} onRemove={uploads.removeUpload} />
                {uploads.readyMaterials.length > remaining && (
                  <p role="alert" className="mt-2.5 text-[12.5px] text-red-fg">
                    Only {remaining} more {remaining === 1 ? "material fits" : "materials fit"} on
                    this practice. Remove some to continue.
                  </p>
                )}
                {attachError && (
                  <p role="alert" className="mt-2.5 text-[12.5px] text-red-fg">
                    {attachError}
                  </p>
                )}
                {uploads.uploads.length > 0 && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={handleAttach}
                      disabled={!canAttach || uploads.isUploading}
                      className={cn(BTN_SECONDARY, "w-full justify-center")}
                    >
                      {attaching ? "Adding" : reading ? "Reading" : "Add & re-run"}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </aside>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3.5">
        <Link href={`/simulation/${simulationId}/panel`} className={BTN_PRIMARY}>
          {copy.cta} <span aria-hidden="true">→</span>
        </Link>
        <span className="text-[12.5px] text-on-surface-3">
          Walking in with gaps is fine. That&apos;s what practice is for.
        </span>
      </div>
    </div>
  )
}

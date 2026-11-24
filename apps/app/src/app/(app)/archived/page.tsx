"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { RotateCcw, Search, Trash2, X } from "lucide-react"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { api } from "@convex/_generated/api"
import { cn, relativeDay } from "@/lib/utils"
import { filterPractices } from "@/lib/findPractices"
import { BTN_SECONDARY } from "@/components/shared/buttons"
import { LaneBadge } from "@/components/shared/LaneBadge"
import {
  DeletePracticeDialog,
  DeletePracticeError,
  useDeletePractice,
} from "@/components/shared/DeletePracticeDialog"
import { useAutoHideScrollbar } from "@/components/shared/useAutoHideScrollbar"

type ArchivedRow = FunctionReturnType<typeof api.practices.listArchived>[number]

const archivedLine = (at: number) => {
  const day = relativeDay(at)
  return `Archived ${day === "Today" || day === "Yesterday" ? day.toLowerCase() : day}`
}

const ArchivedPage = () => {
  const archived = useQuery(api.practices.listArchived)
  const setArchived = useMutation(api.practices.setArchived)
  const removePractice = useDeletePractice()
  const tableScroll = useAutoHideScrollbar<HTMLDivElement>()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [restoreFailed, setRestoreFailed] = useState(false)
  // The target outlives the dialog's open state: clearing it on close would
  // blank the title mid exit animation.
  const [confirmTarget, setConfirmTarget] = useState<ArchivedRow | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)

  const handleClearQuery = () => setQuery("")

  // Restore and delete both unmount the control that had focus with its
  // row, so focus lands somewhere that stays: the search while rows
  // remain, the heading once the last one goes and the search goes too.
  const focusAfterRowLeaves = () =>
    ((archived?.length ?? 0) > 1 ? searchRef : headingRef).current?.focus()

  const handleRestore = (row: ArchivedRow) => {
    setRestoreFailed(false)
    setArchived({ id: row.practiceId, archived: false }).catch(() => setRestoreFailed(true))
    focusAfterRowLeaves()
  }

  const handleRequestDelete = (row: ArchivedRow) => {
    setConfirmTarget(row)
    setConfirmOpen(true)
  }

  const handleConfirmDelete = () => {
    if (!confirmTarget) return
    setConfirmOpen(false)
    setDeleteFailed(false)
    removePractice({ id: confirmTarget.practiceId }).catch(() => setDeleteFailed(true))
    focusAfterRowLeaves()
  }

  if (archived === undefined) return null
  const rows = filterPractices(archived, query, null)

  return (
    <div className="mx-auto max-w-[1200px] px-12 pb-20 pt-[52px] max-lg:px-6 max-md:px-5 max-md:pt-8">
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[.04em] text-on-surface-3">
        <Link href="/" className="focus-ring rounded hover:text-on-surface-2">
          Home
        </Link>{" "}
        / Archived
      </p>
      <h1 ref={headingRef} tabIndex={-1} className="text-[26px] font-semibold tracking-[-.02em] outline-none">
        Archived
      </h1>
      <p className="mt-2 max-w-[52ch] text-[14px] leading-relaxed text-on-surface-2">
        Practices you&apos;re done with. They stay out of the home page and the sidebar, keep
        every session and debrief, and come back with Restore.
      </p>

      {archived.length === 0 ? (
        <p className="mt-8 text-[13.5px] text-on-surface-2">
          Nothing archived yet. Archive a practice from its card or its sidebar row when
          you&apos;re done with it.
        </p>
      ) : (
        <>
          <div className="mb-4 mt-7 flex flex-wrap items-center gap-2.5">
            <label className="relative flex w-[280px] max-w-full items-center max-md:w-full">
              <Search className="pointer-events-none absolute left-3 size-[15px] text-on-surface-3" />
              <span className="sr-only">Find an archived practice</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find an archived practice"
                className="focus-ring h-9 w-full rounded-xl border border-line bg-surface-raised pl-9 pr-8 text-[13.5px] shadow-card outline-none placeholder:text-ink-4 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={handleClearQuery}
                  aria-label="Clear search"
                  className="focus-ring absolute right-2 grid size-6 place-items-center rounded-md text-on-surface-3 hover:text-on-surface"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </label>
            <span className="text-xs text-on-surface-3">Name matches as you type</span>
          </div>
          {restoreFailed && (
            <p role="alert" className="mb-3 text-[12.5px] text-red-fg">
              Couldn&apos;t restore. Check your connection and try again.
            </p>
          )}
          {deleteFailed && <DeletePracticeError className="mb-3" />}
          <section
            aria-label="Archived practices"
            className="flex max-h-[560px] flex-col overflow-hidden rounded-xl border border-line bg-surface-raised shadow-card"
          >
            <div className="flex flex-none items-baseline justify-between px-[18px] py-3.5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
                {archived.length} archived
              </h2>
              <span className="text-xs text-ink-4">Most recently archived first</span>
            </div>
            <div ref={tableScroll} className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto">
              {rows.length === 0 ? (
                <p className="border-t border-line px-[18px] py-6 text-[13.5px] text-on-surface-2">
                  No archived practice matches “{query.trim()}”.
                </p>
              ) : (
                <ul>
                  {rows.map((row) => (
                    <li
                      key={row.practiceId}
                      className="flex items-center gap-3.5 border-t border-line px-[18px] py-3 max-lg:flex-wrap max-lg:gap-x-3 max-lg:gap-y-2"
                    >
                      <Link
                        href={`/p/${row.practiceId}`}
                        className="focus-ring min-w-0 flex-1 truncate rounded text-[14px] font-medium hover:text-accent-blue max-lg:basis-full"
                      >
                        {row.name}
                      </Link>
                      <LaneBadge packId={row.packId} />
                      <span className="w-[150px] text-[12.5px] text-on-surface-3 max-lg:w-auto">
                        {row.sessionCount === 0
                          ? "No sessions"
                          : `${row.sessionCount} session${row.sessionCount === 1 ? "" : "s"} · ${relativeDay(row.lastSessionAt)}`}
                      </span>
                      <span className="w-[130px] text-[12.5px] text-ink-4 max-lg:w-auto">
                        {archivedLine(row.archivedAt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRestore(row)}
                        className={cn(BTN_SECONDARY, "px-3 py-1.5 text-[12.5px] max-lg:ml-auto")}
                      >
                        <RotateCcw className="size-[13px]" />
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRequestDelete(row)}
                        aria-label={`Delete ${row.name}`}
                        className="focus-ring grid size-6 flex-none place-items-center rounded-md text-ink-4 transition-colors hover:bg-surface-3 hover:text-red-fg max-md:size-9"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}

      <DeletePracticeDialog
        name={confirmTarget?.name}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

export default ArchivedPage

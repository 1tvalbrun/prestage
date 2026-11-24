"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { Archive } from "lucide-react"
import { useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"

type Archivable = { practiceId: Id<"practices">; name: string }
type ArchiveToast = Archivable & { failed: boolean }

const TOAST_MS = 6000

const ArchiveContext = createContext<((practice: Archivable) => void) | null>(null)

export const useArchivePractice = () => {
  const archive = useContext(ArchiveContext)
  if (!archive) throw new Error("useArchivePractice needs an ArchiveProvider above it")
  return archive
}

// The row leaves practices.list immediately; Convex rolls the local store
// back if the server rejects the mutation. Restore needs no local edit: the
// archived list is its own query and updates on its own.
const useSetArchived = () =>
  useMutation(api.practices.setArchived).withOptimisticUpdate((localStore, args) => {
    if (!args.archived) return
    const current = localStore.getQuery(api.practices.list, {})
    if (!current) return
    localStore.setQuery(
      api.practices.list,
      {},
      current.filter((practice) => practice.practiceId !== args.id)
    )
  })

// One archive flow for both entry points (the card and the sidebar row):
// the mutation, and the undo toast that follows it.
export const ArchiveProvider = ({ children }: { children: React.ReactNode }) => {
  const setArchived = useSetArchived()
  const [toast, setToast] = useState<ArchiveToast | null>(null)
  const undoRef = useRef<HTMLButtonElement>(null)

  // The toast times itself out, and Undo takes focus so a keyboard user
  // can reach it before it goes. A newer archive restarts both.
  useEffect(() => {
    if (!toast) return
    if (!toast.failed) undoRef.current?.focus()
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  const archive = (practice: Archivable) => {
    setToast({ ...practice, failed: false })
    setArchived({ id: practice.practiceId, archived: true }).catch(() =>
      setToast((current) =>
        current?.practiceId === practice.practiceId ? { ...practice, failed: true } : current
      )
    )
  }

  const handleUndo = () => {
    if (!toast) return
    const { practiceId } = toast
    setToast(null)
    // Nothing to restore if the practice was deleted elsewhere meanwhile.
    setArchived({ id: practiceId, archived: false }).catch(() => {})
  }

  return (
    <ArchiveContext.Provider value={archive}>
      {children}
      {toast && (
        <div
          role="status"
          className="fixed bottom-[max(1.75rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3.5 rounded-[10px] bg-on-surface px-4 py-[11px] text-[13px] text-surface shadow-lg"
        >
          <Archive className="size-3.5 flex-none opacity-60" />
          <span className="min-w-0 truncate">
            {toast.failed ? "Couldn't archive. Try again." : `Archived “${toast.name}”`}
          </span>
          {!toast.failed && (
            <button
              ref={undoRef}
              type="button"
              onClick={handleUndo}
              className="focus-ring flex-none rounded px-1 font-semibold underline-offset-2 hover:underline"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </ArchiveContext.Provider>
  )
}

"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, X } from "lucide-react"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { getPack } from "@/domains/registry"
import type { Scope } from "@/domains/types"
import { flowSteps, type FlowStage } from "@/lib/flowSteps"
import { cn } from "@/lib/utils"
import { LogoMark } from "@/components/shared/LogoMark"
import { BrandName } from "@/components/shared/BrandName"
import { BTN_SECONDARY } from "@/components/shared/buttons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export type { FlowStage }

const STAGE_ROUTES: Record<FlowStage, (simulationId: string) => string> = {
  brief: () => "/simulation/new",
  read: (id) => `/simulation/${id}/analyze`,
  audit: (id) => `/simulation/${id}/audit`,
  panel: (id) => `/simulation/${id}/panel`,
  room: (id) => `/simulation/${id}/room`,
}

export const StageKicker = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.09em] text-on-surface-3">
    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-blue" />
    {children}
  </p>
)

type FlowShellProps = {
  stage: FlowStage
  simulationId?: string
  // Names the lane before a practice exists — the brief stage's wizard
  // knows the lane, the later stages resolve it from the practice.
  packId?: string
  // The brief stage's in-progress scope, which shapes the rail before a
  // practice exists; later stages read the practice's.
  scope?: Scope
  fullBleed?: boolean
  // The room renders the whole shell on the dark surface.
  dark?: boolean
  // When leaving would lose something, the exit action confirms first;
  // label defaults to the stage's exit label.
  confirmExit?: { title: string; description: string; label?: string; confirmLabel?: string }
  // The room's settle fades every piece of chrome, this header included —
  // opacity only, so the layout never collapses under the scene.
  chromeFaded?: boolean
  // Replaces the step rail — the room shows session meta instead of steps.
  centerSlot?: React.ReactNode
  children: React.ReactNode
}

export const FlowShell = ({
  stage,
  simulationId,
  packId,
  scope,
  fullBleed,
  dark,
  confirmExit,
  chromeFaded,
  centerSlot,
  children,
}: FlowShellProps) => {
  const router = useRouter()
  const mainRef = useRef<HTMLElement>(null)
  // The rail's shape comes from the lane and the practice's scope (the
  // middle beat's name, or its absence). Resolved from the packId and scope
  // props when the caller knows them, else from the practice; the default
  // covers the frame before either loads.
  const practice = useQuery(
    api.practices.get,
    packId || !simulationId ? "skip" : { id: simulationId as Id<"practices"> }
  )
  const pack = packId ? getPack(packId) : practice ? getPack(practice.packId) : null
  const displaySteps = flowSteps(pack, scope ?? practice?.scope ?? {})
  const currentIndex = displaySteps.findIndex((step) => step.keys.includes(stage))

  useEffect(() => {
    mainRef.current?.focus()
  }, [stage])

  // The only door out of the flow, so it reads as a button on every stage.
  // Before the brief is submitted nothing exists to keep, so leaving is a
  // cancel. From the read on, the practice is already saved as it goes.
  const exitClass = cn(
    BTN_SECONDARY,
    "flex-none whitespace-nowrap px-3.5 py-2 text-[13px] hover:text-on-surface max-md:py-2.5"
  )
  const exitLabel = stage === "brief" ? "Cancel" : "Exit"
  const ExitIcon = stage === "brief" ? X : LogOut

  return (
    <div
      data-surface={dark ? "dark" : undefined}
      className="flex h-dvh flex-col bg-surface text-on-surface"
    >
      <header
        className={cn(
          "flex flex-none items-center gap-[26px] border-b border-line bg-surface-rail px-6 py-3.5 transition-opacity duration-700 motion-reduce:transition-none max-md:gap-3 max-md:px-4 max-md:py-3",
          chromeFaded && "pointer-events-none opacity-0"
        )}
      >
        <Link href="/" className="focus-ring flex flex-none items-center gap-2">
          <LogoMark size="sm" />
          <span className="text-sm font-semibold max-md:hidden">
            <BrandName />
          </span>
        </Link>

        {centerSlot ? (
          <div className="flex min-w-0 flex-1 justify-center">{centerSlot}</div>
        ) : (
        <nav aria-label="Practice progress" className="flex min-w-0 flex-1 justify-center">
          {/* The four-step rail needs ~340px it will never get on a phone —
              below md the current step stands alone with its position. */}
          <p className="hidden items-center gap-2 font-mono text-[11px] uppercase tracking-[.04em] max-md:flex">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-blue" />
            <span className="truncate text-accent-blue">
              {displaySteps[currentIndex]?.label}
            </span>
            <span className="flex-none tabular-nums text-ink-4">
              {currentIndex + 1}/{displaySteps.length}
            </span>
          </p>
          <ol className="flex items-center max-md:hidden">
            {displaySteps.map((displayStep, i) => {
              const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "upcoming"
              const lastKey = displayStep.keys[displayStep.keys.length - 1]
              const href =
                state === "done" && simulationId && lastKey !== "brief"
                  ? STAGE_ROUTES[lastKey](simulationId)
                  : null
              const step = (
                <span
                  className={cn(
                    "flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[.04em]",
                    state === "active" && "text-accent-blue",
                    state === "done" && "text-on-surface-3",
                    state === "upcoming" && "text-ink-4"
                  )}
                >
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                  {displayStep.label}
                </span>
              )
              return (
                <li
                  key={displayStep.label}
                  aria-current={state === "active" ? "step" : undefined}
                  className="flex items-center"
                >
                  {href ? (
                    <Link href={href} className="focus-ring">
                      {step}
                    </Link>
                  ) : (
                    step
                  )}
                  {i < displaySteps.length - 1 && (
                    <span aria-hidden="true" className="mx-2.5 h-px w-[26px] bg-line-2" />
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
        )}

        {confirmExit ? (
          <AlertDialog>
            <AlertDialogTrigger className={exitClass}>
              <ExitIcon className="size-[14px]" />
              {confirmExit.label ?? exitLabel}
            </AlertDialogTrigger>
            <AlertDialogContent size="sm" data-surface={dark ? "dark" : undefined}>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmExit.title}</AlertDialogTitle>
                <AlertDialogDescription>{confirmExit.description}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Stay</AlertDialogCancel>
                <AlertDialogAction onClick={() => router.push("/")}>
                  {confirmExit.confirmLabel ?? confirmExit.label ?? exitLabel}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Link href="/" className={exitClass}>
            <ExitIcon className="size-[14px]" />
            {exitLabel}
          </Link>
        )}
      </header>

      <main
        ref={mainRef}
        tabIndex={-1}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto outline-none"
      >
        {fullBleed ? (
          children
        ) : (
          <div className="mx-auto w-full max-w-[1080px] px-10 pb-[90px] pt-10 max-md:px-5 max-md:pb-16 max-md:pt-7">{children}</div>
        )}
      </main>
    </div>
  )
}

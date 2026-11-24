"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { castOf, resolveCounterpart } from "@/domains/cast"
import { getPack, lockedArchetype, variantOf } from "@/domains/registry"
import {
  firstNameOf,
  scopeList,
  scopeText,
  type Archetype,
  type Counterpart,
  type DomainPack,
  type Scope,
} from "@/domains/types"
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/shared/buttons"
import { ReceiptChip } from "@/components/shared/ReceiptChip"
import { StageKicker } from "@/components/simulation/flow/FlowShell"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"
import { MicCheck } from "@/components/simulation/intake/MicCheck"
import type { MicCheckResult } from "@/lib/micCheck"

// The archetype whose declared territory (tags + attack line) overlaps the
// thing the user asked to have challenged; the pack's own opinion first.
// No match, no invented reason.
const recommendArchetype = (pack: DomainPack, scope: Scope): { archetype: Archetype; reason: string } => {
  const packPick = pack.recommendArchetype?.(scope) ?? null
  const picked = packPick && pack.archetypes.find((a) => a.id === packPick.archetypeId)
  if (picked && packPick) return { archetype: picked, reason: packPick.reason }
  const focus = scopeList(scope, "focusAreas")[0] ?? scopeText(scope, "focusAreas")
  if (focus) {
    const words = focus.toLowerCase().split(/\s+/).filter((word) => word.length > 3)
    for (const archetype of pack.archetypes) {
      const territory = [...archetype.tags, ...archetype.attack.map((s) => s.text)].join(" ").toLowerCase()
      if (words.some((word) => territory.includes(word))) {
        return { archetype, reason: `Targets ${focus.toLowerCase()}` }
      }
    }
  }
  return { archetype: pack.archetypes[0], reason: "A strong first read" }
}

const roomLine = (minutes: number, closingRead: boolean, first: string) =>
  closingRead
    ? `${minutes} min · ends on their verdict or the clock · debrief after`
    : `${minutes} min · ${first} decides in the first thirty seconds`

const PortraitTile = ({ counterpart, className }: { counterpart: Counterpart; className?: string }) => (
  <div className={cn("relative overflow-hidden bg-surface-2", className)}>
    <Image
      src={counterpart.image}
      alt=""
      fill
      priority
      sizes="(max-width: 768px) 100vw, 320px"
      // Top-anchored crop keeps the face when a portrait-orientation photo
      // meets the wide tile.
      className="object-cover object-top"
    />
    <span className="absolute bottom-2 left-2.5 font-mono text-[10px] font-medium uppercase tracking-[.1em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,.45)]">
      {counterpart.shortRole}
    </span>
  </div>
)

const AttackLine = ({ counterpart }: { counterpart: Counterpart }) => (
  <p className="text-[13px] leading-normal text-on-surface-2">
    {counterpart.attack.map((segment, i) => (
      <span key={i} className={segment.strong ? "font-medium text-on-surface" : undefined}>
        {segment.text}
      </span>
    ))}
  </p>
)

const Stamp = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-block rounded-full border border-line-2 bg-surface-2 px-[9px] py-[2.5px] text-[10px] font-semibold uppercase tracking-[.08em] text-on-surface-2">
    {children}
  </span>
)

const FaceAgain = ({
  practiceId,
  counterpart,
}: {
  practiceId: Id<"practices">
  counterpart: Counterpart
}) => {
  const faceAgain = useMutation(api.practices.faceAgain)
  const [failed, setFailed] = useState(false)
  const handleFaceAgain = async () => {
    setFailed(false)
    try {
      await faceAgain({ id: practiceId, personaId: counterpart.id })
    } catch {
      setFailed(true)
    }
  }
  return (
    <div>
      <button
        type="button"
        onClick={handleFaceAgain}
        className="focus-ring text-[12.5px] text-on-surface-3 underline-offset-2 hover:text-accent-blue hover:underline"
      >
        Face {firstNameOf(counterpart.name)} again instead
      </button>
      {failed && (
        <p role="alert" className="mt-1 text-[12.5px] text-red-fg">
          Couldn&apos;t switch. Try again.
        </p>
      )}
    </div>
  )
}

const CONSENT =
  "Sessions are live voice conversations with an AI avatar. Entering the room is your consent to your audio being transcribed and the conversation being processed, and possibly recorded, by our avatar provider to run the session."

type PanelSetupProps = {
  simulationId: string
}

export const PanelSetup = ({ simulationId }: PanelSetupProps) => {
  const router = useRouter()
  const typedId = simulationId as Id<"practices">
  const practice = useQuery(api.practices.get, { id: typedId })
  const liveSession = useQuery(api.sessions.getLive, { practiceId: typedId })
  const materials = useQuery(api.materials.listByPractice, { practiceId: typedId })
  const met = useQuery(api.practices.metFaces, practice ? { packId: practice.packId } : "skip")
  const ensureCast = useMutation(api.practices.ensureCast)
  const createSession = useMutation(api.sessions.create)
  // The archetype id currently entering a room, or null. Not a plain
  // boolean: on Safari the entered card can differ from the highlighted
  // one, so each card's own "Opening the room" state reads this against
  // its own archetype id.
  const [startingId, setStartingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [enterFailed, setEnterFailed] = useState(false)
  const [castFailed, setCastFailed] = useState(false)
  // Advisory only: entering never depends on it.
  const [micCheck, setMicCheck] = useState<MicCheckResult | null>(null)

  // Practices from before casts get one here. The mutation is a no-op once
  // the cast exists, so this runs at most once per practice.
  const needsCast = practice !== undefined && practice !== null && !practice.cast
  useEffect(() => {
    if (needsCast) ensureCast({ id: typedId }).catch(() => setCastFailed(true))
  }, [needsCast, ensureCast, typedId])

  const handleEnterRoom = async (archetypeId: string) => {
    if (startingId) return
    setStartingId(archetypeId)
    setEnterFailed(false)
    try {
      await createSession({
        practiceId: typedId,
        archetypeId,
        ...(micCheck
          ? { micCheck: { verdict: micCheck.verdict, noiseDb: micCheck.noiseDb, voiceDb: micCheck.voiceDb } }
          : {}),
      })
      router.push(`/simulation/${simulationId}/room`)
    } catch {
      setEnterFailed(true)
      setStartingId(null)
    }
  }

  if (practice === undefined || liveSession === undefined) return null
  if (practice === null) return <IdeaNotFound />
  const pack = getPack(practice.packId)
  const variant = variantOf(pack, practice.scope)
  const cast = practice.cast
  if (!cast) {
    if (!castFailed) return null
    return (
      <div>
        <StageKicker>{pack.copy.panel.kicker}</StageKicker>
        <p role="alert" className="text-[13.5px] text-on-surface-2">
          Couldn&apos;t set up your counterpart. Reload to try again.
        </p>
      </div>
    )
  }

  if (variant.prep && !practice.context) {
    return (
      <div>
        <StageKicker>{pack.copy.panel.kicker}</StageKicker>
        <p className="text-[13.5px] text-on-surface-2">
          Your brief is still being read. Your counterpart needs it before the questions start.{" "}
          <Link href={`/simulation/${simulationId}/analyze`} className="focus-ring underline hover:text-accent-blue">
            Back to the read
          </Link>
          .
        </p>
      </div>
    )
  }

  if (liveSession && !startingId) {
    return (
      <div className="mx-auto max-w-[560px] pt-10 text-center">
        <h1 className="text-[20px] font-semibold tracking-[-.015em]">A session is already live.</h1>
        <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed text-on-surface-2">
          {liveSession.persona.name} is in the room for this practice. Rejoin to pick up where you left off.
        </p>
        <Link href={`/simulation/${simulationId}/room`} className={cn(BTN_PRIMARY, "mt-6 inline-flex")}>
          Rejoin the room <ArrowRight className="size-3.5" />
        </Link>
      </div>
    )
  }

  const locked = lockedArchetype(pack, variant)
  const fixedId = practice.personaId ?? (locked ? cast[locked.id] : undefined)
  const fixed = fixedId ? resolveCounterpart(pack, fixedId) : null
  const hasSessions = (practice.sessionCount ?? 0) > 0
  const openItems = (practice.continuity?.actionItems ?? []).filter((item) => item.status === "open").length
  const gapCount = practice.audit?.status === "ready" ? practice.audit.gaps.length : 0
  const docChips = (materials ?? []).map((material) => material.name)
  const metFaces = met ?? []
  const otherMet = (archetypeId: string, drawnId: string): Counterpart[] =>
    castOf(pack, archetypeId).flatMap((face) => {
      if (face.id === drawnId || !metFaces.includes(face.id)) return []
      const counterpart = resolveCounterpart(pack, face.id)
      return counterpart ? [counterpart] : []
    })
  const metAgain = fixed ? otherMet(fixed.archetypeId, fixed.id)[0] : undefined
  const shownLine = roomLine(variant.roomMinutes, variant.closingRead, fixed ? firstNameOf(fixed.name) : "")

  return (
    <div className="mx-auto max-w-[980px] text-center">
      <h1 className="text-[20px] font-semibold tracking-[-.015em]">{pack.copy.panel.heading}</h1>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[.09em] text-on-surface-3">{shownLine}</p>
      <p className="mx-auto mb-9 mt-2.5 max-w-[54ch] text-sm leading-relaxed text-on-surface-2">
        {variant.prep && `${fixed ? `${firstNameOf(fixed.name)} has` : "They've all"} read your brief${docChips.length > 0 ? " and your documents" : ""}. `}
        {variant.copy.panelLead}
      </p>

      {fixed ? (
        <div className="mx-auto max-w-[660px] overflow-hidden rounded-2xl border border-line bg-surface-raised text-left shadow-card">
          <PortraitTile counterpart={fixed} className="aspect-[5/3] w-full" />
          <div className="p-7 pb-5 max-md:p-5 max-md:pb-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Stamp>
                {variant.remembers && hasSessions
                  ? `Continue with ${firstNameOf(fixed.name)}${openItems > 0 ? ` · ${openItems} open item${openItems === 1 ? "" : "s"}` : ""}`
                  : pack.shortLabel}
              </Stamp>
              {pack.sessionMetaField && scopeText(practice.scope, pack.sessionMetaField) && (
                <span className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-on-surface-3">
                  {scopeText(practice.scope, pack.sessionMetaField)}
                </span>
              )}
            </div>
            <p className="text-[19px] font-semibold tracking-[-.015em]">{fixed.name}</p>
            <p className="mb-2.5 mt-0.5 text-[13px] text-on-surface-3">{fixed.role}</p>
            <AttackLine counterpart={fixed} />
            <p className="mt-3 font-serif text-[15px] italic leading-normal text-on-surface-2">
              &ldquo;{fixed.signature}&rdquo;
            </p>
          </div>
          {variant.prep && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface px-7 py-3.5 max-md:px-5">
              <span className="text-xs text-on-surface-3">{firstNameOf(fixed.name)}&apos;s read:</span>
              <ReceiptChip label="Your brief" />
              {docChips.map((name) => (
                <ReceiptChip key={name} label={name} />
              ))}
              {gapCount > 0 && <ReceiptChip label={`The gap map · ${gapCount} open`} />}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3.5 border-t border-line px-7 py-4 max-md:px-5">
            <button
              type="button"
              onClick={() => handleEnterRoom(fixed.archetypeId)}
              disabled={startingId !== null}
              className={BTN_PRIMARY}
            >
              {startingId ? "Opening the room" : "Enter the room"}
              {!startingId && <ArrowRight className="size-3.5" />}
            </button>
            {!hasSessions && metAgain && <FaceAgain practiceId={typedId} counterpart={metAgain} />}
          </div>
        </div>
      ) : (
        <ChooserCards
          pack={pack}
          scope={practice.scope}
          cast={cast}
          selectedId={selectedId}
          onSelect={setSelectedId}
          startingId={startingId}
          onEnter={handleEnterRoom}
          practiceId={typedId}
          otherMet={otherMet}
        />
      )}

      <div className="mt-4">
        <MicCheck
          counterpartFirstName={fixed ? firstNameOf(fixed.name) : null}
          onResult={setMicCheck}
        />
      </div>

      {!fixed && (
        <p className="mt-7 flex flex-wrap items-center justify-center gap-2 text-[12.5px] text-on-surface-3">
          They&apos;ve all read:
          <ReceiptChip label="Your brief" />
          {docChips.map((name) => (
            <ReceiptChip key={name} label={name} />
          ))}
          <span>· You can face the others in another practice.</span>
        </p>
      )}

      {enterFailed && (
        <p role="alert" className="mt-5 text-[13px] text-red-fg">
          Couldn&apos;t open the room. Check your connection and try again.
        </p>
      )}

      <p className="mx-auto mt-9 max-w-[560px] text-[11.5px] leading-relaxed text-ink-4">{CONSENT}</p>
    </div>
  )
}

const ChooserCards = ({
  pack,
  scope,
  cast,
  selectedId,
  onSelect,
  startingId,
  onEnter,
  practiceId,
  otherMet,
}: {
  pack: DomainPack
  scope: Scope
  cast: Record<string, string>
  selectedId: string | null
  onSelect: (archetypeId: string) => void
  startingId: string | null
  onEnter: (archetypeId: string) => void
  practiceId: Id<"practices">
  otherMet: (archetypeId: string, drawnId: string) => Counterpart[]
}) => {
  const recommended = recommendArchetype(pack, scope)
  const rendered = pack.archetypes.flatMap((archetype) => {
    const counterpart = resolveCounterpart(pack, cast[archetype.id])
    return counterpart ? [{ archetype, counterpart }] : []
  })
  const isRendered = (id: string) => rendered.some((entry) => entry.archetype.id === id)
  const activeId =
    (selectedId && isRendered(selectedId) ? selectedId : null) ??
    (isRendered(recommended.archetype.id) ? recommended.archetype.id : null) ??
    rendered[0]?.archetype.id ??
    null
  return (
    <div className="mb-6 grid grid-cols-3 items-stretch gap-4 text-left max-lg:mx-auto max-lg:max-w-[440px] max-lg:grid-cols-1">
      {rendered.map(({ archetype, counterpart }) => {
        const isSelected = activeId === archetype.id
        const isRecommended = archetype.id === recommended.archetype.id
        const metAgain = otherMet(archetype.id, counterpart.id)[0]
        return (
          <div
            key={archetype.id}
            onClick={() => onSelect(archetype.id)}
            className={cn(
              "relative flex flex-col overflow-hidden rounded-2xl border bg-surface-raised shadow-card transition-colors",
              isSelected ? "border-accent-blue ring-1 ring-accent-blue" : "border-line"
            )}
          >
            {isSelected && (
              <span className="absolute left-1/2 top-3 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-blue px-3 py-[3px] text-[10px] font-semibold uppercase tracking-[.07em] text-primary-foreground">
                Your counterpart
              </span>
            )}
            <PortraitTile counterpart={counterpart} className="aspect-[5/3] w-full flex-none" />
            <div className="flex flex-1 flex-col px-5 pb-4 pt-4">
              {isRecommended && (
                <div className="mb-2">
                  <Stamp>Recommended · {recommended.reason}</Stamp>
                </div>
              )}
              <p className="text-base font-semibold tracking-[-.01em]">{counterpart.name}</p>
              <p className="mb-2.5 mt-0.5 text-[12.5px] text-on-surface-3">{counterpart.role}</p>
              <div className="flex-1 pb-3">
                <AttackLine counterpart={counterpart} />
              </div>
              <p className="border-t border-line pt-3 font-serif text-sm italic leading-normal text-on-surface-2">
                &ldquo;{counterpart.signature}&rdquo;
              </p>
            </div>
            <div className="flex flex-col gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={() => onEnter(archetype.id)}
                onFocus={() => onSelect(archetype.id)}
                disabled={startingId !== null}
                className={cn(isSelected ? BTN_PRIMARY : BTN_SECONDARY, "w-full")}
              >
                {startingId === archetype.id
                  ? "Opening the room"
                  : `Practice with ${firstNameOf(counterpart.name)}`}
                {isSelected && startingId !== archetype.id && <ArrowRight className="size-3.5" />}
              </button>
              {metAgain && <FaceAgain practiceId={practiceId} counterpart={metAgain} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

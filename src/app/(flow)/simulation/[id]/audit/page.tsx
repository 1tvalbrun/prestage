"use client"

import { use, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { getPack, variantOf } from "@/domains/registry"
import { FlowShell } from "@/components/simulation/flow/FlowShell"
import { AuditStage } from "@/components/simulation/intake/AuditStage"
import { BlueprintStage } from "@/components/simulation/intake/BlueprintStage"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"

// One route, two prep stages: the practice's pack declares whether its
// middle beat is the claims audit or the interview blueprint. A practice
// without prep has no middle beat and lands on the panel.
const PrepPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params)
  const router = useRouter()
  const practice = useQuery(api.practices.get, { id: id as Id<"practices"> })
  const pack = practice ? getPack(practice.packId) : null
  const skipsPrep = practice && pack ? !variantOf(pack, practice.scope).prep : false

  useEffect(() => {
    if (skipsPrep) router.replace(`/simulation/${id}/panel`)
  }, [skipsPrep, router, id])

  return (
    <FlowShell stage="audit" simulationId={id}>
      {practice === undefined || skipsPrep ? null : practice === null ? (
        <IdeaNotFound />
      ) : pack?.prep.kind === "blueprint" ? (
        <BlueprintStage simulationId={id} />
      ) : (
        <AuditStage simulationId={id} />
      )}
    </FlowShell>
  )
}

export default PrepPage

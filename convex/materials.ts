import { v } from "convex/values"
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { ownedOrNull, requireIdentity } from "./guard"

// Storage deletes are not transactional and a missing file throws, so a
// delete that races another (the hourly sweep, a purge that rolled back)
// must not fail the mutation it rides in: the end state is the same.
export const releaseFile = async (ctx: MutationCtx, storageId: Id<"_storage">) => {
  await ctx.storage.delete(storageId).catch(() => {})
}

// Names and statuses only — extracted text stays server-side (this is not
// a data room).
export const listByPractice = query({
  args: { practiceId: v.id("practices") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const practice = ownedOrNull(identity, await ctx.db.get(args.practiceId))
    if (!practice) return []
    const materials = await ctx.db
      .query("materials")
      .withIndex("by_practice", (q) => q.eq("practiceId", args.practiceId))
      .collect()
    return materials.map((material) => ({
      materialId: material._id,
      name: material.name,
      status: material.status,
      failureReason: material.failureReason ?? null,
    }))
  },
})

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

export const getForExtraction = internalQuery({
  args: { materialId: v.id("materials") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.materialId)
  },
})

export const setExtractionResult = internalMutation({
  args: {
    materialId: v.id("materials"),
    result: v.union(
      v.object({ status: v.literal("ready"), text: v.string() }),
      v.object({ status: v.literal("failed"), failureReason: v.string() })
    ),
  },
  handler: async (ctx, args) => {
    // The file has served its purpose either way: the text is what every
    // later read uses, and a failed file is re-uploaded, not retried.
    const material = await ctx.db.get(args.materialId)
    if (!material) return
    if (material.storageId) await releaseFile(ctx, material.storageId)
    await ctx.db.patch(args.materialId, { ...args.result, storageId: undefined })
  },
})

// Files uploaded on an intake that was abandoned, or removed from its list,
// never get a material row, and extraction deletes every file it reads
// within minutes of upload. So any file older than this is nobody's.
const ORPHAN_FILE_AGE_MS = 24 * 60 * 60 * 1000
const SWEEP_BATCH = 100

// Hourly (convex/crons.ts). Oldest first, bounded per run, no reference
// check: a referenced file is minutes old.
export const sweepOrphans = internalMutation({
  args: { olderThanMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - (args.olderThanMs ?? ORPHAN_FILE_AGE_MS)
    const files = await ctx.db.system.query("_storage").order("asc").take(SWEEP_BATCH)
    let deleted = 0
    for (const file of files) {
      if (file._creationTime >= cutoff) break
      await releaseFile(ctx, file._id)
      deleted += 1
    }
    return { deleted }
  },
})

// One-time, CLI-only: release the files of every settled material, from
// before extraction deleted them, and clear the references. Materials
// still extracting keep theirs. Idempotent: run it before the sweep.
//   npx convex run materials:purgeStoredFiles
export const purgeStoredFiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const materials = await ctx.db.query("materials").collect()
    let released = 0
    for (const material of materials) {
      if (!material.storageId || material.status === "extracting") continue
      await releaseFile(ctx, material.storageId)
      await ctx.db.patch(material._id, { storageId: undefined })
      released += 1
    }
    return { released }
  },
})

export const allSettled = internalQuery({
  args: { practiceId: v.id("practices") },
  handler: async (ctx, args) => {
    const materials = await ctx.db
      .query("materials")
      .withIndex("by_practice", (q) => q.eq("practiceId", args.practiceId))
      .collect()
    return materials.every((material) => material.status !== "extracting")
  },
})

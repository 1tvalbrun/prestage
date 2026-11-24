import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

// Uploaded files are deleted by extraction within minutes; anything older
// than a day is an orphan from an abandoned intake (materials.sweepOrphans).
crons.interval("sweep orphaned files", { hours: 1 }, internal.materials.sweepOrphans, {})

export default crons

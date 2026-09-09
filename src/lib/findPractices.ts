type Findable = { name: string; packId: string }

// The home page's "Find a practice": a name match, a lane, or both, over
// the list already loaded. An empty query and no lane return everything.
export const filterPractices = <T extends Findable>(
  practices: T[],
  query: string,
  lane: string | null
): T[] => {
  const needle = query.trim().toLowerCase()
  return practices.filter(
    (practice) =>
      (lane === null || practice.packId === lane) &&
      (needle.length === 0 || practice.name.toLowerCase().includes(needle))
  )
}

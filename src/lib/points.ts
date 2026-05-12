export interface ScoreInput {
  playerId: string
  strokes: number       // net score
  grossStrokes?: number // used as tiebreaker when net scores are equal
}

export interface ScoreResult extends ScoreInput {
  rank: number
  points: number
}

export function assignPoints(scores: ScoreInput[]): ScoreResult[] {
  const n = scores.length
  const sorted = [...scores].sort((a, b) => {
    if (a.strokes !== b.strokes) return a.strokes - b.strokes
    // Tiebreak by gross when available (lower gross wins)
    if (a.grossStrokes != null && b.grossStrokes != null) return a.grossStrokes - b.grossStrokes
    return 0
  })

  // Two entries are truly tied only when net AND gross are identical (or both lack gross)
  function areTied(a: ScoreInput, b: ScoreInput) {
    if (a.strokes !== b.strokes) return false
    if (a.grossStrokes != null && b.grossStrokes != null) return a.grossStrokes === b.grossStrokes
    return a.grossStrokes == null && b.grossStrokes == null
  }

  const results: ScoreResult[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i + 1
    while (j < sorted.length && areTied(sorted[i], sorted[j])) j++
    const tiedCount = j - i
    const totalPoints = Array.from({ length: tiedCount }, (_, k) => n - i - k).reduce((a, b) => a + b, 0)
    const avgPoints = totalPoints / tiedCount
    for (let k = i; k < j; k++) {
      results.push({ ...sorted[k], rank: i + 1, points: avgPoints })
    }
    i = j
  }
  return results
}

export function randomizeGroups(players: string[], groupSize: number): string[][] {
  const shuffled = [...players].sort(() => Math.random() - 0.5)
  const n = shuffled.length
  const numGroups = Math.ceil(n / groupSize)
  // All groups except the first are filled to exactly groupSize.
  // The first group gets whatever is left (≤ groupSize).
  const firstSize = n - (numGroups - 1) * groupSize
  const groups: string[][] = [shuffled.slice(0, firstSize)]
  for (let i = 1; i < numGroups; i++) {
    groups.push(shuffled.slice(firstSize + (i - 1) * groupSize, firstSize + i * groupSize))
  }
  return groups
}

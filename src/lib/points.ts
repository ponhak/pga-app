export interface ScoreInput {
  playerId: string
  strokes: number
}

export interface ScoreResult extends ScoreInput {
  rank: number
  points: number
}

export function assignPoints(scores: ScoreInput[]): ScoreResult[] {
  const n = scores.length
  const sorted = [...scores].sort((a, b) => a.strokes - b.strokes)

  // Group by strokes to handle ties
  const results: ScoreResult[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j < sorted.length && sorted[j].strokes === sorted[i].strokes) j++
    // Players i..j-1 are tied
    const tiedCount = j - i
    // Points they share: sum of positions n-i, n-i-1, ..., n-j+1
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
  const groups: string[][] = []
  for (let i = 0; i < shuffled.length; i += groupSize) {
    groups.push(shuffled.slice(i, i + groupSize))
  }
  return groups
}

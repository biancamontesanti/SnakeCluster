export type ScoreRecord = { address: string; name: string; score: number }

/** Merge-only high scores: an unavailable read can never erase earlier scores. */
export class ScoreStore {
  private scores = new Map<string, ScoreRecord>()
  private pending = new Map<string, ScoreRecord>()

  merge(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false
    const row = value as ScoreRecord
    if (typeof row.address !== 'string' || typeof row.name !== 'string' || !Number.isSafeInteger(row.score) || row.score < 0) return false
    const address = row.address.toLowerCase()
    const previous = this.scores.get(address)
    if (previous && previous.score >= row.score) return false
    this.scores.set(address, { address, name: row.name.slice(0, 24), score: row.score })
    return true
  }

  record(row: ScoreRecord) {
    if (this.merge(row)) this.pending.set(row.address.toLowerCase(), { ...row, address: row.address.toLowerCase() })
  }

  best(address: string) { return this.scores.get(address.toLowerCase())?.score ?? 0 }
  rows() { return [...this.scores.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name) || a.address.localeCompare(b.address)) }
  get pendingCount() { return this.pending.size }

  async flush(save: (row: ScoreRecord) => Promise<boolean>) {
    // Sequential writes stay below the hosted server's in-flight request cap.
    for (const [address, snapshot] of [...this.pending]) {
      try {
        if (await save(snapshot) && this.pending.get(address) === snapshot) this.pending.delete(address)
      } catch { /* Keep dirty entries for the next checkpoint. */ }
    }
  }
}

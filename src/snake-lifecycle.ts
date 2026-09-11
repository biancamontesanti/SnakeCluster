export type LifeStamp = { session: number; run: number; sequence: number }
type PeerLife = LifeStamp & { dead: boolean }

/** Keep death tombstones independently of render entities and timeout cleanup. */
export class SnakeLifecycle {
  private peers = new Map<string, PeerLife>()

  accept(player: string, stamp: LifeStamp, dead: boolean): boolean {
    if (!player || ![stamp.session, stamp.run, stamp.sequence].every(n => Number.isSafeInteger(n) && n >= 0)) return false
    const previous = this.peers.get(player)
    if (previous) {
      if (stamp.session < previous.session) return false
      if (stamp.session === previous.session) {
        if (stamp.run < previous.run || stamp.sequence < previous.sequence) return false
        // The server may adjudicate death at the last movement sequence. It
        // must override that alive snapshot even without another client tick.
        if (stamp.sequence === previous.sequence && !(dead && !previous.dead && stamp.run === previous.run)) return false
        // No movement update can revive this life, even after a long disconnect.
        if (stamp.run === previous.run && previous.dead && !dead) return false
      }
    }
    this.peers.set(player, { ...stamp, dead })
    return true
  }
}

type Point3 = { x: number; y: number; z: number }

/** Only an actually rendered body edge may kill; pooled/hidden blocks cannot. */
export function touchesBody(point: Point3, from: Point3, to: Point3, radiusSquared: number): boolean {
  if (from.y < 0 || to.y < 0) return false
  const dx = to.x - from.x, dz = to.z - from.z
  const lengthSquared = dx * dx + dz * dz
  const t = lengthSquared > 0.000001
    ? Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSquared))
    : 0
  const px = point.x - from.x - dx * t, pz = point.z - from.z - dz * t
  return px * px + pz * pz < radiusSquared
}

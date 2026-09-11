export type ArenaPoint = { x: number; z: number }

// A head sphere (.26 radius) touching the diamond body (~.17 radius).
export const HEAD_BODY_RADIUS = .43
export const SNAKE_STALE_MS = 3000
export const SPAWN_SHIELD_MS = 1750
export const REMAINS_LIFETIME_MS = 45000

function pointDistanceSquared(p: ArenaPoint, a: ArenaPoint, b: ArenaPoint) {
  const dx = b.x - a.x, dz = b.z - a.z
  const size = dx * dx + dz * dz
  const t = size > 1e-10 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / size)) : 0
  return (p.x - a.x - dx * t) ** 2 + (p.z - a.z - dz * t) ** 2
}

/** Capsule sweep: includes contact between samples, not only at the endpoint. */
export function headCrossesBody(from: ArenaPoint, to: ArenaPoint, a: ArenaPoint, b: ArenaPoint, radius = HEAD_BODY_RADIUS) {
  const cross = (u: ArenaPoint, v: ArenaPoint, p: ArenaPoint) => (v.x - u.x) * (p.z - u.z) - (v.z - u.z) * (p.x - u.x)
  const c1 = cross(from, to, a), c2 = cross(from, to, b)
  const c3 = cross(a, b, from), c4 = cross(a, b, to)
  if (c1 * c2 < 0 && c3 * c4 < 0) return true
  return Math.min(pointDistanceSquared(from, a, b), pointDistanceSquared(to, a, b),
    pointDistanceSquared(a, from, to), pointDistanceSquared(b, from, to)) <= radius * radius
}

export function livingLength(earned: number, spent: number) { return Math.max(5, 9 + earned - spent) }

export function longestLiving<T extends { playerId: string; phase: string; length: number }>(players: T[]): T | undefined {
  return players.filter(p => p.phase === 'running')
    .sort((a, b) => b.length - a.length || a.playerId.localeCompare(b.playerId))[0]
}

import { ArenaPoint } from './combat'

export const MOVEMENT_INTERVAL = 1 / 30
export const SNAPSHOT_INTERVAL_MS = 50
export const COMBAT_INTERVAL_MS = 1000 / 30
// A gentler cruise speed gives the snapshot presentation enough visual room
// while retaining the exact same server-authoritative movement model.
export const BASE_SPEED = 3.04
export const MAX_TURN_RATE = 5.8
export const MOBILE_TURN_RATE = 3.4
export type Motion = { x: number; z: number; heading: number; spent: number; boostTimer: number; speed?: number }
export function stepMotion(m: Motion, turn: number, boost: boolean, earned: number, dt: number) {
  turn = Number.isFinite(turn) ? Math.max(-MAX_TURN_RATE, Math.min(MAX_TURN_RATE, turn)) : 0
  boost = boost && 9 + earned - m.spent > 5
  m.heading += turn * dt
  m.boostTimer = boost ? m.boostTimer + dt : 0
  while (m.boostTimer >= .55) { m.spent++; m.boostTimer -= .55 }
  const targetSpeed = BASE_SPEED * (boost ? 1.72 : 1) * (1 - Math.abs(turn / MAX_TURN_RATE) * .35)
  // Smooth speed changes on the server, without adding steering-release inertia.
  const speed = (m.speed ?? BASE_SPEED) + (targetSpeed - (m.speed ?? BASE_SPEED)) * (1 - Math.exp(-dt * 10))
  m.speed = speed
  const midHeading = m.heading - turn * dt * .5
  m.x += Math.sin(midHeading) * speed * dt
  m.z += Math.cos(midHeading) * speed * dt
  return speed
}
export function spawnMotion(id: string, run: number): Motion {
  let seed = 2166136261
  for (const c of `${id}:${run}`) { seed ^= c.charCodeAt(0); seed = Math.imul(seed, 16777619) }
  seed >>>= 0
  const angle = seed / 0xffffffff * Math.PI * 2
  const radius = 9.5 + ((seed >>> 8) % 180) / 100
  return { x: 16 + Math.sin(angle) * radius, z: 16 + Math.cos(angle) * radius,
    heading: angle + ((seed & 1) === 0 ? Math.PI / 2 : -Math.PI / 2), spent: 0, boostTimer: 0 }
}
export type PoseFrame = { at: number; points: ArenaPoint[]; heading: number; speed: number }


/** Presentation only: interpolate confirmed poses, never invent future movement. */
export class SnapshotTrack {
  private frames: PoseFrame[] = []
  clear() { this.frames.length = 0 }
  push(frame: PoseFrame) {
    if (!Number.isFinite(frame.at) || !frame.points.length || !frame.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.z))) return
    const last = this.frames[this.frames.length - 1]
    if (last && frame.at <= last.at) return
    this.frames.push(frame)
    while (this.frames.length > 40) this.frames.shift()
  }
  sample(at: number): PoseFrame | undefined {
    const frames = this.frames
    if (!frames.length) return undefined
    if (at <= frames[0].at) return frames[0]
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1], b = frames[i]
      if (at > b.at) continue
      const t = (at - a.at) / (b.at - a.at)
      const count = Math.max(a.points.length, b.points.length)
      const point = (points: ArenaPoint[], progress: number) => {
        const index = progress * (points.length - 1), left = Math.floor(index)
        const p = points[left], q = points[Math.min(left + 1, points.length - 1)]
        return { x: p.x + (q.x - p.x) * (index - left), z: p.z + (q.z - p.z) * (index - left) }
      }
      const angle = Math.atan2(Math.sin(b.heading - a.heading), Math.cos(b.heading - a.heading))
      return { at, heading: a.heading + angle * t, speed: a.speed + (b.speed - a.speed) * t,
        points: Array.from({ length: count }, (_, j) => {
          const p = point(a.points, j / Math.max(1, count - 1)), q = point(b.points, j / Math.max(1, count - 1))
          return { x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t }
        }) }
    }
    return frames[frames.length - 1] // A gap freezes safely; no overshoot/snap-back.
  }
}

/** Shared by all visible snakes; packet arrivals never directly move the camera/head. */
export class PresentationClock {
  time = 0
  private newest = 0
  private arrivedAt = 0
  // Keep more than two 50 ms network frames in reserve. Rendering slightly
  // behind the authoritative stream lets SnapshotTrack interpolate through
  // normal packet jitter instead of pausing at a frame then catching up.
  private readonly interpolationDelayMs = 100
  observe(serverAt: number, localAt: number) {
    if (Number.isFinite(serverAt) && serverAt > this.newest) { this.newest = serverAt; this.arrivedAt = localAt }
  }
  advance(localAt: number, dt: number) {
    if (!this.newest) return this.time
    const target = Math.min(this.newest, this.newest + localAt - this.arrivedAt - this.interpolationDelayMs)
    if (!this.time || target - this.time > 1000) this.time = target
    else {
      const step = Math.min(.1, Math.max(0, dt)) * 1000
      this.time = Math.min(this.newest, this.time + Math.max(0, step + Math.max(-step * .15, Math.min(step * .15, target - this.time - step))))
    }
    return this.time
  }
}

/** Clock offsets never use unsynchronised wall clocks to calculate latency. */
export class NetworkClock {
  rttMs: number | null = null
  private offset = 0
  private bestRtt = Infinity
  private lastSample = 0
  accept(sent: number, server: number, received: number) {
    const rtt = received - sent
    if (![sent, server, received].every(Number.isFinite) || rtt < 0 || rtt > 5000) return
    this.rttMs = this.rttMs === null ? rtt : this.rttMs * .8 + rtt * .2
    if (rtt <= this.bestRtt || received - this.lastSample > 30000) {
      this.offset = server - (sent + received) / 2
      this.bestRtt = rtt
      this.lastSample = received
    }
  }
  serverNow(now: number) { return now + this.offset }
  get synchronized() { return this.rttMs !== null }
}

export function chunkFrames(frames: string[], maxChars = 10000): string[][] {
  const chunks: string[][] = []
  let chunk: string[] = [], size = 0
  for (const frame of frames) {
    // JSON is ASCII escaped by the server, so character count bounds wire bytes.
    if (frame.length > maxChars) continue
    if (size + frame.length + 8 > maxChars && chunk.length) { chunks.push(chunk); chunk = []; size = 0 }
    chunk.push(frame); size += frame.length + 8
  }
  if (chunk.length) chunks.push(chunk)
  return chunks
}

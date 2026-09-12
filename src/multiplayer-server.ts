import { engine, Entity, executeTask } from '@dcl/sdk/ecs'
import { syncEntity } from '@dcl/sdk/network'
import { AUTH_SERVER_PEER_ID } from '@dcl/sdk/network/message-bus-sync'
import { Storage } from '@dcl/sdk/server'
import { Color4, Vector3 } from '@dcl/sdk/math'
import { FOOD_PICKUP_RADIUS_SQUARED, MatchPlayer, SavedScore, ServerStatus, SharedFood, SnakeSnapshot, room } from './multiplayer-state'
import { ScoreStore } from './score-store'
import { HEAD_BODY_RADIUS, headCrossesBody, livingLength, REMAINS_LIFETIME_MS, SNAKE_STALE_MS, SPAWN_SHIELD_MS } from './combat'
import { chunkFrames, COMBAT_INTERVAL_MS, Motion, spawnMotion, stepMotion, SNAPSHOT_INTERVAL_MS, MAX_TURN_RATE, MOBILE_TURN_RATE } from './netcode'
import { deathFoodColor } from './snake-skins'
import { keyboardTurnRate } from './steering'

type Point = { x: number; z: number }
type Presence = { playerId: string; name: string; phase: string; session: number; run: number; sequence: number; skin: number; spent: number; points: Point[]; killerId?: string; deathReason?: string; sampleTime?: number; heading?: number; speed?: number; turn?: number; boosting?: boolean; steer?: number; pointerTurn?: number; mobile?: boolean }
type Peer = { address: string; entity: Entity; state: Presence; seen: number; started: number; earned: number; kills: number; peak: number; deadRun: number; points: Point[]; motion?: Motion; revision: number; ack?: number; checkpointAt: number; steeringVelocity?: number; activeBoost?: boolean }
const peers = new Map<string, Peer>()
const items = new Map<string, Entity>()
const scores = new ScoreStore()
const rankingEntities: Entity[] = []
const colors = ['#ff2d95ff', '#7b61ffff', '#00d4ffff', '#ffb800ff'].map(Color4.fromHexString)
const epoch = Date.now()
const prefix = 'snake-cluster.score.v1:'
let status: Entity
let dropCounter = 0
let saveRunning = false, loadRunning = false
let lastSave = 0, lastLoad = 0, lastTick = 0
let lastCombatAt = 0, lastFramesAt = 0
const pendingFrames = new Map<Entity, string>()
// A denser, server-owned field gives players more moment-to-moment choices.
// Positions still come from openPosition(), so spacing and pickup authority
// remain unchanged.
const INITIAL_FOOD_COUNT = 60
const ARENA_MIN = 1.25
const ARENA_MAX = 30.75

function validPoint(p: Point) { return p && Number.isFinite(p.x) && Number.isFinite(p.z) && p.x >= .25 && p.x <= 31.75 && p.z >= .25 && p.z <= 31.75 }
function hitsArenaFence(p: Point) { return p.x < ARENA_MIN || p.x > ARENA_MAX || p.z < ARENA_MIN || p.z > ARENA_MAX }
function openPosition() {
  let result = Vector3.create(2, .28, 2)
  for (let attempt = 0; attempt < 40; attempt++) {
    result = Vector3.create(2 + Math.random() * 28, .28, 2 + Math.random() * 28)
    if (![...items.values()].some(e => {
      const item = SharedFood.getOrNull(e)
      return item?.active && Vector3.distanceSquared(result, item.position) < .64
    })) break
  }
  return result
}

function addFood(id: string, dropped = false, owner?: Peer, position = openPosition(), deathSequence = 0, value = 1, piece = 0) {
  const entity = engine.addEntity()
  SharedFood.create(entity, {
    epoch, id, revision: 1, position, color: dropped && owner ? deathFoodColor(owner.state.skin, piece) : colors[Math.floor(Math.random() * colors.length)],
    size: dropped ? .13 + Math.random() * .1 : .2, active: true, dropped,
    expiresAt: dropped ? Date.now() + REMAINS_LIFETIME_MS : 0, value,
    ownerId: owner?.state.playerId ?? '', session: owner?.state.session ?? 0, run: owner?.state.run ?? 0, sequence: deathSequence
  })
  syncEntity(entity, [SharedFood.componentId])
  items.set(id, entity)
}

function publishPeer(peer: Peer, checkpoint = false) {
  if (!MatchPlayer.has(peer.entity)) {
    peer.entity = engine.addEntity()
    MatchPlayer.create(peer.entity)
    syncEntity(peer.entity, [MatchPlayer.componentId, SnakeSnapshot.componentId])
  }
  const length = livingLength(peer.earned, peer.state.spent)
  const score = peer.state.run > 0 ? length + peer.kills * 10 : 0
  peer.peak = Math.max(peer.peak, score)
  if (peer.peak > 0) scores.record({ address: peer.address, name: peer.state.name, score: peer.peak })
  const next = { epoch, address: peer.address, playerId: peer.state.playerId, name: peer.state.name, score, best: scores.best(peer.address), run: peer.state.run, earned: peer.earned, kills: peer.kills, phase: peer.state.phase, length }
  const current = MatchPlayer.get(peer.entity)
  if ((Object.keys(next) as Array<keyof typeof next>).some(key => current[key] !== next[key])) Object.assign(MatchPlayer.getMutable(peer.entity), next)
  const payload = JSON.stringify({ ...peer.state, boosting: !!peer.activeBoost, score, sequence: ++peer.revision, ack: peer.ack || 0,
    sampleTime: peer.state.sampleTime || Date.now(), motion: peer.motion, earned: peer.earned,
    length,
    points: peer.state.phase === 'running' ? Array.from({ length: Math.min(36, peer.points.length) }, (_, i) => peer.points[Math.round(i * (peer.points.length - 1) / Math.max(1, Math.min(36, peer.points.length) - 1))]) : [] }).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
  pendingFrames.set(peer.entity, payload)
  // Full CRDT snapshots are retained for joins/recovery, not the movement stream.
  if ((checkpoint || peer.state.phase !== 'running' || Date.now() - peer.checkpointAt >= 1000) && SnakeSnapshot.getOrNull(peer.entity)?.payload !== payload) {
    SnakeSnapshot.createOrReplace(peer.entity, { epoch, payload })
    peer.checkpointAt = Date.now()
  }
}

function flushFrames() {
  for (const frames of chunkFrames([...pendingFrames.values()])) void room.send('arenaFrames', { epoch, frames })
  pendingFrames.clear()
  const now = Date.now()
  // Preserve the 50 ms cadence across 33 ms simulation frames instead of drifting to 66 ms.
  lastFramesAt = lastFramesAt ? now - ((now - lastFramesAt) % SNAPSHOT_INTERVAL_MS) : now
}

/** One terminal transaction per life, independent of message arrival order. */
function finishDeath(peer: Peer, killerId = '', sequence = peer.state.sequence, reason = 'Head collision', awardKill = true) {
  if (peer.deadRun === peer.state.run || peer.state.run <= 0) return
  peer.deadRun = peer.state.run
  peer.state.phase = 'gameover'
  peer.state.sequence = Math.max(peer.state.sequence, sequence)
  peer.state.killerId = killerId
  peer.state.deathReason = reason
  const killer = [...peers.values()].find(p => p.state.playerId === killerId && p.state.phase === 'running')
  if (awardKill && killer && killer !== peer) { killer.kills++; publishPeer(killer) }
  const mass = Math.max(9, Math.floor(livingLength(peer.earned, peer.state.spent) * .75))
  const count = Math.min(40, mass)
  for (let i = 0; i < count; i++) {
    // Stratified random positions spread the remains over the complete trail.
    const progress = ((i + Math.random()) / count) * Math.max(0, peer.points.length - 1)
    const index = Math.floor(progress), mix = progress - index
    const a = peer.points[index], b = peer.points[Math.min(index + 1, peer.points.length - 1)]
    if (!a || !b) break
    const angle = Math.random() * Math.PI * 2, radius = .18 + Math.random() * .45
    const position = Vector3.create(
      Math.max(1.75, Math.min(30.25, a.x + (b.x - a.x) * mix + Math.cos(angle) * radius)), .28,
      Math.max(1.75, Math.min(30.25, a.z + (b.z - a.z) * mix + Math.sin(angle) * radius)))
    const value = Math.floor(mass / count) + (i < mass % count ? 1 : 0)
    addFood(`drop-${++dropCounter}`, true, peer, position, peer.revision + 1, value, i)
  }
  publishPeer(peer); publishRanking(); saveScores()
}

function combatTick(now: number) {
  const live = [...peers.values()].filter(p => p.state.phase === 'running' && p.motion)
    .sort((a, b) => a.state.playerId.localeCompare(b.state.playerId))
  const previous = new Map(live.map(p => [p, { x: p.motion!.x, z: p.motion!.z }]))
  for (const peer of live) {
    const m = peer.motion!
    peer.ack = peer.state.sequence
    peer.state.sampleTime = now
    const fresh = Date.now() - peer.seen < 500
    const steer = fresh ? peer.state.steer || 0 : 0
    peer.steeringVelocity = keyboardTurnRate(peer.steeringVelocity || 0, steer, COMBAT_INTERVAL_MS / 1000,
      peer.state.mobile ? MOBILE_TURN_RATE : MAX_TURN_RATE, peer.state.mobile ? 7.5 : 12)
    const turn = steer ? peer.steeringVelocity : fresh ? peer.state.pointerTurn || 0 : 0
    peer.activeBoost = fresh && !!peer.state.boosting && livingLength(peer.earned, m.spent) > 5
    peer.state.speed = stepMotion(m, turn, peer.activeBoost, peer.earned, COMBAT_INTERVAL_MS / 1000)
    peer.state.heading = m.heading; peer.state.spent = m.spent
    peer.points.unshift({ x: m.x, z: m.z })
    let distance = 0
    for (let i = 1; i < peer.points.length; i++) {
      distance += Math.hypot(peer.points[i].x - peer.points[i-1].x, peer.points[i].z - peer.points[i-1].z)
      if (distance >= Math.min(512, livingLength(peer.earned, m.spent)) * .24) { peer.points.length = i + 1; break }
    }
    // Pickup authority follows the swept head, not the client's claimed position.
    for (const entity of items.values()) {
      const food = SharedFood.getOrNull(entity)
      if (!food?.active || (food.expiresAt && food.expiresAt <= now)) continue
      if (!headCrossesBody(previous.get(peer)!, m, food.position, food.position, Math.sqrt(FOOD_PICKUP_RADIUS_SQUARED))) continue
      const item = SharedFood.getMutable(entity); item.revision++
      if (food.dropped) item.active = false
      else item.position = openPosition()
      peer.earned += Math.max(1, food.value || 1)
    }
  }
  const hits: Array<{ victim: Peer; killer?: Peer; reason: string }> = []
  for (const victim of live) {
    const head = victim.motion!, from = previous.get(victim)!
    if (hitsArenaFence(head)) {
      hits.push({ victim, reason: 'Arena collision' }); continue
    }
    if (now - victim.started < SPAWN_SHIELD_MS) continue
    for (const killer of live) {
      const body = killer.points
      let distance = 0, contact = false
      for (let i = 1; i < body.length; i++) {
        distance += Math.hypot(body[i].x-body[i-1].x, body[i].z-body[i-1].z)
        if (killer === victim && distance < 2.64) continue
        // The local snake uses the same head/body capsule as every rival.
        // A smaller self radius made grazing an on-screen body inconsistent
        // with the server's actual collision decision.
        if (headCrossesBody(from, head, body[i-1], body[i], HEAD_BODY_RADIUS)) { contact = true; break }
      }
      if (contact) { hits.push({ victim, killer: killer === victim ? undefined : killer,
        reason: killer === victim ? 'Self collision' : `Blocked by ${killer.state.name}` }); break }
    }
  }
  // Decide all contacts against one immutable tick before changing any lives.
  // A simultaneous crash cannot depend on whose packet arrived first.
  for (const hit of hits) {
    finishDeath(hit.victim, hit.killer?.state.playerId || '', hit.victim.state.sequence, hit.reason, false)
  }
  for (const { killer } of hits) if (killer) killer.kills++
  for (const peer of live) publishPeer(peer)
  if (hits.length) flushFrames()
}

function publishRanking() {
  const rows = scores.rows().slice(0, 100)
  while (rankingEntities.length > rows.length) engine.removeEntity(rankingEntities.pop()!)
  rows.forEach((row, i) => {
    let entity = rankingEntities[i]
    if (entity === undefined || !SavedScore.has(entity)) {
      entity = engine.addEntity(); rankingEntities[i] = entity
      SavedScore.create(entity, { epoch, rank: i + 1, ...row })
      syncEntity(entity, [SavedScore.componentId])
    } else {
      const old = SavedScore.get(entity)
      if (old.address !== row.address || old.score !== row.score || old.name !== row.name) SavedScore.createOrReplace(entity, { epoch, rank: i + 1, ...row })
    }
  })
}

function loadScores() {
  if (loadRunning) return
  loadRunning = true; lastLoad = Date.now()
  executeTask(async () => {
    try {
      let offset = 0, total = 0
      do {
        const result = await Storage.getValues({ prefix, limit: 100, offset })
        for (const entry of result.data) {
          try { scores.merge(typeof entry.value === 'string' ? JSON.parse(entry.value) : entry.value) } catch { /* Ignore malformed legacy records. */ }
        }
        total = result.pagination.total
        if (!result.data.length) break
        offset += result.data.length
      } while (offset < total)
      publishRanking()
    } catch (error) { console.error('[Snake Cluster] Score load failed; retrying', error) }
    finally { loadRunning = false; ServerStatus.getMutable(status).loading = false }
  })
}

function saveScores() {
  if (saveRunning || !scores.pendingCount) return
  saveRunning = true; lastSave = Date.now()
  executeTask(async () => {
    try {
      // Each server session owns a different key. A failed/empty historical
      // read can never overwrite another session's durable record.
      await scores.flush(row => Storage.set(`${prefix}${epoch}:${row.address}`, JSON.stringify(row)))
    } finally { saveRunning = false; ServerStatus.getMutable(status).pendingSaves = scores.pendingCount }
  })
}

export function initMultiplayerServer() {
  const serverOnly = (value: { senderAddress: string }) => value.senderAddress === AUTH_SERVER_PEER_ID
  SharedFood.validateBeforeChange(serverOnly)
  SnakeSnapshot.validateBeforeChange(serverOnly)
  MatchPlayer.validateBeforeChange(serverOnly)
  SavedScore.validateBeforeChange(serverOnly)
  ServerStatus.validateBeforeChange(serverOnly)
  status = engine.addEntity()
  ServerStatus.create(status, { epoch, heartbeat: Date.now(), loading: true, pendingSaves: 0 })
  // The third argument is a fixed network entity id, not a sync interval.
  syncEntity(status, [ServerStatus.componentId], 9000)
  for (let i = 0; i < INITIAL_FOOD_COUNT; i++) addFood(`food-${i}`)
  loadScores()

  room.onMessage('ping', (message, context) => {
    if (!context || !Number.isSafeInteger(message.sentAt)) return
    void room.send('pong', { sentAt: message.sentAt, serverAt: Date.now() }, { to: [context.from] })
  })

  room.onMessage('snakePresence', (message, context) => {
    if (!context || message.payload.length > 12000) return
    let state: Presence
    try { state = JSON.parse(message.payload) } catch { return }
    const address = context.from.toLowerCase()
    if (!state || typeof state.playerId !== 'string' || !state.playerId.toLowerCase().startsWith(`${address}:`)) return
    if (![state.session, state.run, state.sequence, state.spent].every(n => Number.isSafeInteger(n) && n >= 0)) return
    if (!['ready', 'running', 'gameover', 'exited'].includes(state.phase) || !Array.isArray(state.points) || state.points.length > 36) return
    if (state.points.some(p => !validPoint(p))) return
    state.name = String(state.name || 'PLAYER').slice(0, 24)
    let peer = peers.get(address)
    const now = Date.now()
    if (peer) {
      if (state.session < peer.state.session || (state.session === peer.state.session && state.sequence <= peer.state.sequence)) return
      if (state.session === peer.state.session && state.run < peer.state.run) return
      if (state.session === peer.state.session && state.run === peer.deadRun) {
        peer.seen = now
        return
      }
      if (state.session !== peer.state.session || state.run > peer.state.run) {
        saveScores(); peer.earned = 0; peer.kills = 0; peer.started = now; peer.deadRun = -1; peer.points = []; peer.motion = undefined; peer.steeringVelocity = 0; peer.activeBoost = false
      }
    } else {
      const entity = engine.addEntity()
      MatchPlayer.create(entity)
      syncEntity(entity, [MatchPlayer.componentId, SnakeSnapshot.componentId])
      peer = { address, entity, state, seen: now, started: now, earned: 0, kills: 0, peak: 0, deadRun: -1, points: [], revision: 0, checkpointAt: 0 }
      peers.set(address, peer)
    }
    if (state.phase === 'gameover') return // Terminal outcomes belong exclusively to simulation.
    if (state.phase === 'running' && !peer.motion) {
      peer.motion = spawnMotion(state.playerId, state.run)
      const m = peer.motion
      peer.points = Array.from({ length: 10 }, (_, i) => ({
        x: m.x - Math.sin(m.heading) * i * .24, z: m.z - Math.cos(m.heading) * i * .24
      }))
    }
    state.turn = Number.isFinite(state.turn) ? Math.max(-6.4, Math.min(6.4, state.turn!)) : 0
    state.steer = state.steer === -1 || state.steer === 1 ? state.steer : 0
    state.mobile = state.mobile === true
    state.pointerTurn = !state.mobile && Number.isFinite(state.pointerTurn) ? Math.max(-2.9, Math.min(2.9, state.pointerTurn!)) : 0
    state.boosting = state.boosting === true
    state.spent = peer.motion?.spent || 0
    state.heading = peer.motion?.heading || 0
    state.sampleTime = peer.state.sampleTime || now
    state.speed = peer.state.speed || 0
    peer.state = state; peer.seen = now

    // Running input receipts do not publish a new pose: only simulation ticks do.
    if (state.phase !== 'running' || !SnakeSnapshot.has(peer.entity)) publishPeer(peer)
    if (state.phase === 'gameover' || state.phase === 'exited') saveScores()
  })

  room.onMessage('collectFood', (message, context) => {
    if (!context || message.items.length > 40) return
    const peer = peers.get(context.from.toLowerCase())
    if (!peer || peer.state.phase !== 'running' || peer.state.playerId !== message.playerId || peer.state.run !== message.run || !peer.points.length) return
    const head = peer.points[0]
    // Claims follow a movement snapshot; never accept an unrelated location.
    if (!validPoint(message) || Math.hypot(message.x - head.x, message.z - head.z) > 1.25) return
    const now = Date.now()
    for (const claim of message.items) {
      const entity = items.get(claim.id)
      const food = entity === undefined ? undefined : SharedFood.getOrNull(entity)
      if (entity === undefined || !food?.active || food.revision !== claim.revision || (food.expiresAt > 0 && now >= food.expiresAt)) continue
      const dx = food.position.x - head.x, dz = food.position.z - head.z
      if (dx * dx + dz * dz > FOOD_PICKUP_RADIUS_SQUARED + 0.00001) continue
      const mutable = SharedFood.getMutable(entity)
      mutable.revision++
      if (food.dropped) mutable.active = false
      else mutable.position = openPosition()
      peer.earned += Math.max(1, food.value || 1)
    }
    publishPeer(peer)
  })

  // Legacy client death receipts cannot kill players or replace authoritative trails.
  room.onMessage('snakeDeath', () => {})

  engine.addSystem(() => {
    const now = Date.now()
    if (!lastCombatAt) lastCombatAt = now
    let steps = 0
    while (now - lastCombatAt >= COMBAT_INTERVAL_MS && steps++ < 5) {
      lastCombatAt += COMBAT_INTERVAL_MS; combatTick(lastCombatAt)
    }
    if (now - lastCombatAt > 200) lastCombatAt = now
    if (now - lastFramesAt >= SNAPSHOT_INTERVAL_MS && pendingFrames.size) flushFrames()
    if (now - lastTick < 500) return
    lastTick = now
    const health = ServerStatus.getMutable(status)
    health.heartbeat = now; health.pendingSaves = scores.pendingCount
    for (const [id, entity] of items) {
      const food = SharedFood.getOrNull(entity)
      if (!food) { items.delete(id); continue }
      if (food.dropped && now >= food.expiresAt) {
        if (food.active) { const mutable = SharedFood.getMutable(entity); mutable.active = false; mutable.revision++ }
        if (now > food.expiresAt + 5000) { engine.removeEntity(entity); items.delete(id) }
      }
    }
    for (const [address, peer] of peers) if (now - peer.seen > 12000) {
      peer.state.phase = 'exited'
      publishPeer(peer); saveScores(); engine.removeEntity(peer.entity); peers.delete(address)
    }
    publishRanking()
    if (now - lastSave >= 15000) saveScores()
    if (now - lastLoad >= 60000) loadScores()
  })
}

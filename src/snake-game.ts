import {
  Entity,
  EngineInfo,
  Animator,
  AudioSource,
  AvatarModifierArea,
  AvatarModifierType,
  Billboard,
  BillboardMode,
  InputAction,
  InputModifier,
  GltfContainer,
  MainCamera,
  Material,
  MaterialTransparencyMode,
  MeshRenderer,
  PointerLock,
  PrimaryPointerInfo,
  Schemas,
  TouchScreenControls,
  TextAlignMode,
  TextShape,
  TextureFilterMode,
  TextureWrapMode,
  Transform,
  VirtualCamera,
  VisibilityComponent,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector2, Vector3 } from '@dcl/sdk/math'
import { isStateSyncronized, syncEntity } from '@dcl/sdk/network'
import { getPlatform, isMobile } from '@dcl/sdk/platform'
import { getPlayer } from '@dcl/sdk/src/players'
import { movePlayerTo } from '~system/RestrictedActions'
import { mouseTurnRate } from './steering'
import { SnakeLifecycle, touchesBody } from './snake-lifecycle'
import { FOOD_PICKUP_RADIUS_SQUARED, SharedFood, MatchPlayer, SavedScore, SnakeSnapshot, room } from './multiplayer-state'
import { serverConnection } from './server-connection'
import { headCrossesBody, longestLiving, SNAKE_STALE_MS } from './combat'
import { MOVEMENT_INTERVAL, NetworkClock, Motion, SnapshotTrack, PresentationClock } from './netcode'
import { CameraRig } from './camera-rig'
const cameraRig = new CameraRig()

type GamePhase = 'ready' | 'running' | 'gameover' | 'exited'
export type ControlMode = 'mouse' | 'keyboard'

import { snakeSkins } from './snake-skins'
export { snakeSkins } from './snake-skins'

const ARENA_MIN = 1.25
const ARENA_MAX = 30.75
const START = Vector3.create(16, 0.32, 16)
// Slower angular rotation plus corner-speed assistance keeps the compact
// ~0.46 m turning circle without the previous twitchy spin.
const SEGMENT_SPACING = 0.24
const BODY_BLOCK_SIZE = 0.235
const BODY_BLOCK_OVERLAP = 1.18
const TAIL_TAPER_SEGMENTS = 10
const TAIL_MIN_SCALE = 0.45
const BODY_COLLISION_RADIUS_SQUARED = 0.0529
const START_SEGMENTS = 9
const FOOD_COUNT = 40
const FOOD_Y = 0.28
const FOOD_MIN_SPACING_SQUARED = 0.64
const TEST_SECONDS = 300
const CONTROL_PASS_SECONDS = 60
const THEME_AUDIO = 'assets/Audio/snake-cluster-theme.mp3'
const EAT_AUDIO = 'assets/Audio/eat.mp3'
const DEATH_AUDIO = 'assets/Audio/died.mp3'
const ENEMY_DEATH_AUDIO = 'assets/Audio/enemy-death.mp3'
const UI_CLICK_AUDIO = 'assets/Audio/button-sound.mp3'
const SMALL_RUSTIC_FENCE_SRC = 'assets/asset-packs/small_rustic_fence/FenceWoodSmall_01/FenceWoodSmall_01.glb'
const RUSTIC_FENCE_GROUND_Y = 0.78
// Original meshes are baked into meter-sized copies by fit-headwear.cjs.
// Keep all runtime scales in a normal range for mobile asset conversion.
const MOBILE_HEADWEAR_SCALE = 0.8
const REWARD_HAT_SCALE = 1.3
const MOBILE_TURN_RESPONSE = 7.5
const FOOD_SYNC_ID_START = 4100
const NETWORK_SEND_INTERVAL = MOVEMENT_INTERVAL
const NETWORK_IDLE_INTERVAL = 0.75
const NETWORK_TRAIL_SAMPLES = 36
const REMOTE_RENDER_SEGMENTS = 48
const MAX_LOCAL_RENDER_SEGMENTS = 128
const INITIAL_LOCAL_SEGMENT_POOL = 32
const MAX_LOGICAL_TRAIL_SEGMENTS = 512
const REMOTE_STALE_SECONDS = SNAKE_STALE_MS / 1000
const REMOTE_REMOVE_SECONDS = 12
const SPAWN_GRACE_SECONDS = 1.75
const DIAMOND_TILT = Quaternion.fromEulerDegrees(35.264, 0, 45)

const DeathDropState = engine.defineComponent('snakeCluster::deathDrop', {
  active: Schemas.Boolean,
  ownerId: Schemas.String,
  dropId: Schemas.String,
  expiresAt: Schemas.Int64
})
// Separate component keeps the existing food schema compatible.
const DeathDropOrigin = engine.defineComponent('snakeCluster::deathDropOrigin', {
  session: Schemas.Int64,
  run: Schemas.Int,
  sequence: Schemas.Int
})

type NetworkPoint = { x: number, z: number }
type SnakeStatePacket = {
  sampleTime?: number
  speed?: number
  session: number
  run: number
  playerId: string
  name: string
  phase: GamePhase
  sequence: number
  heading: number
  length: number
  score: number
  skin: number
  hat: number
  boosting: boolean
  points: NetworkPoint[]
}
type SnakeDeathPacket = {
  session: number
  run: number
  victimId: string
  victimName: string
  killerId: string
  sequence: number
}
type LeaderboardRow = { name: string, score: number, player: boolean, playerId: string }
type RemoteSnake = {
  track?: SnapshotTrack
  run?: number
  session?: number
  sampleTime?: number
  speed?: number
  playerId: string
  name: string
  phase: GamePhase
  sequence: number
  heading: number
  length: number
  score: number
  skin: number
  hat: number
  boosting: boolean
  lastSeen: number
  head: Entity
  eyes: Entity[]
  segments: Entity[]
  label: Entity
  targetPoints: Vector3[]
  displayHead: Vector3
}

const remoteSnakes = new Map<string, RemoteSnake>()
const lifecycle = new SnakeLifecycle()
const processedDeaths = new Set<string>()
const networkSession = Date.now()
let multiplayerReady = false
let networkSendTimer = 0
let networkSequence = 0
let matchKills = 0
let runSpawn = Vector3.clone(START)


export const snakeHats = [
  { name: 'Pirate', src: 'assets/Models/Pirate-fitted.glb', scale: 1, offset: Vector3.Zero() },
  { name: 'Santa', src: 'assets/Models/Santa-fitted.glb', scale: 1, offset: Vector3.Zero() },
  { name: 'Sombrero', src: 'assets/Models/Sombrero-fitted.glb', scale: 1, offset: Vector3.Zero() },
  { name: 'Witch', src: 'assets/Models/Witch-fitted.glb', scale: 1, offset: Vector3.Zero() }
]

const palette = [
  Color4.fromHexString('#ff2d95ff'),
  Color4.fromHexString('#7b61ffff'),
  Color4.fromHexString('#00d4ffff'),
  Color4.fromHexString('#ffb800ff')
]

let phase: GamePhase = 'ready'
let heading = 0
let runsStarted = 0
let energyCollected = 0
let runEnergy = 0
let lastDeathPoints: NetworkPoint[] = []
let lastKillerId = ''
let lastDeathReason = ''
let testElapsed = 0
let testStarted = false
let resultMessage = 'Press E to start'
let selectedSkin = 0
let menuOpen = true
let currentRunElapsed = 0
let boostTimer = 0
let boostSpent = 0
let boostUsed = false
let boostingActive = false
let desktopPassed = false
let mobilePassed = false
let uiElapsed = 0
let newlyUnlockedSkin = -1
let newlyUnlockedHat = -1
let equippedHat = -1
const ownedHats = [false, false, false, false]
let hatRoot: Entity
let hatModel: Entity
let rewardHatRoot: Entity
let rewardHatModel: Entity
let crownRoot: Entity
let crownModel: Entity
let playerTagRoot: Entity
let playerPortrait: Entity
let playerNameLabel: Entity
let playerDisplayName = 'PLAYER'
let profileUserId = ''
const networkSessionNonce = Math.floor(Math.random() * 0x7fffffff).toString(36)
let networkPlayerId = ''
let chest: Entity
let chestSpawnTimer = 75 + Math.random() * 90
let chestActive = false
let chestSequence: 'idle' | 'opening' | 'hatReveal' = 'idle'
let chestSequenceTimer = 0
let pendingHat = -1
const announcedUnlocks = new Set<number>()
let themeAudio: Entity
const eatAudioPool: Entity[] = []
let nextEatAudio = 0
let deathAudio: Entity
let enemyDeathAudio: Entity
let uiClickAudio: Entity
let musicEnabled = true
let soundEnabled = true
let eatCooldown = 0
let exitedArenaOnce = false
let menuSession = 0
let appliedThemeVolume = 0.18

let head: Entity
let camera: Entity
let avatarHider: Entity
const segments: Entity[] = []
let renderedSegmentCount = 0
const foods: Entity[] = []
const serverFoodVisuals = new Map<string, { entity: Entity; revision: number; active: boolean; x: number; z: number }>()
const pendingFoodClaims = new Map<string, { revision: number; sentAt: number }>()
let serverEpoch = 0
let waitingToStart = false
const eyes: Entity[] = []
const positionTrail: Vector3[] = []
type DeathDrop = { entity: Entity, active: boolean }
const deathDrops: DeathDrop[] = []
const DEATH_DROP_COUNT = 18
const MAX_LOCAL_DEATH_DROPS = 96
const DEATH_DROP_LIFESPAN_MS = 45000
type SandStamp = { entity: Entity, age: number, active: boolean }
const sandTracks: SandStamp[] = []
const SAND_STAMP_COUNT = 72
const SAND_STAMP_LIFESPAN = 54
const SAND_STAMP_INTERVAL = 0.72
let sandStampTimer = SAND_STAMP_INTERVAL
let nextSandStamp = 0

function createBox(position: Vector3, scale: Vector3, color: Color4): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, { position, scale })
  MeshRenderer.setBox(entity)
  Material.setPbrMaterial(entity, { albedoColor: color, roughness: 0.72, metallic: 0.05 })
  return entity
}

function createSphere(position: Vector3, scale: Vector3, color: Color4): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, { position, scale })
  MeshRenderer.setSphere(entity)
  Material.setPbrMaterial(entity, {
    albedoColor: color,
    emissiveColor: Color3.create(color.r * 0.18, color.g * 0.18, color.b * 0.18),
    emissiveIntensity: 0.45,
    roughness: 0.35
  })
  return entity
}

function createDiamondBlock(position: Vector3, scale: Vector3, color: Color4): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, { position, scale, rotation: DIAMOND_TILT })
  // A box is 12 triangles. The former SDK sphere uses hundreds of triangles,
  // so this preserves the bright faceted look at a fraction of the GPU cost.
  MeshRenderer.setBox(entity)
  Material.setPbrMaterial(entity, {
    albedoColor: color,
    emissiveColor: Color3.create(color.r * 0.12, color.g * 0.12, color.b * 0.12),
    emissiveIntensity: 0.32,
    roughness: 0.38,
    metallic: 0.03
  })
  return entity
}

function randomArenaPosition(y = 0.42): Vector3 {
  return Vector3.create(2 + Math.random() * 28, y, 2 + Math.random() * 28)
}

function seededFoodPosition(index: number, attempt = 0): Vector3 {
  // Every client creates the fixed food field at the same coordinates before
  // CRDT reconciliation, eliminating the join-frame pop caused by Math.random.
  let seed = (((index + 1) * 2654435761) ^ ((attempt + 1) * 2246822519)) >>> 0
  seed = (seed * 1664525 + 1013904223) >>> 0
  const x = seed / 0xffffffff
  seed = (seed * 1664525 + 1013904223) >>> 0
  const z = seed / 0xffffffff
  return Vector3.create(2 + x * 28, FOOD_Y, 2 + z * 28)
}

function buildArena() {
  const arenaFloor = createBox(Vector3.create(16, 0.05, 16), Vector3.create(31.5, 0.1, 31.5), Color4.White())
  Material.setPbrMaterial(arenaFloor, {
    texture: Material.Texture.Common({
      src: 'assets/Textures/dcl-sand.png',
      wrapMode: TextureWrapMode.TWM_REPEAT,
      filterMode: TextureFilterMode.TFM_TRILINEAR,
      tiling: Vector2.create(8, 8)
    }),
    albedoColor: Color4.White(),
    roughness: 0.98,
    metallic: 0,
    castShadows: false
  })
  const fenceInset = 0.9
  const fenceStart = ARENA_MIN + fenceInset
  const fenceEnd = ARENA_MAX - fenceInset
  const fenceCount = 23
  const fenceStep = (fenceEnd - fenceStart) / (fenceCount - 1)
  for (let module = 0; module < fenceCount; module++) {
    const along = fenceStart + module * fenceStep
    createRusticFence(Vector3.create(along, RUSTIC_FENCE_GROUND_Y, ARENA_MIN - 0.2), 90)
    createRusticFence(Vector3.create(along, RUSTIC_FENCE_GROUND_Y, ARENA_MAX + 0.2), 90)
    createRusticFence(Vector3.create(ARENA_MIN - 0.2, RUSTIC_FENCE_GROUND_Y, along), 0)
    createRusticFence(Vector3.create(ARENA_MAX + 0.2, RUSTIC_FENCE_GROUND_Y, along), 0)
  }

}

function createRusticFence(position: Vector3, yaw: number): Entity {
  const fence = engine.addEntity()
  Transform.create(fence, {
    position,
    rotation: Quaternion.fromEulerDegrees(0, yaw, 0),
    scale: Vector3.One()
  })
  GltfContainer.create(fence, {
    src: SMALL_RUSTIC_FENCE_SRC,
    visibleMeshesCollisionMask: 0,
    invisibleMeshesCollisionMask: 0
  })
  return fence
}

function removeAuthoredFencePlaceholders() {
  for (const name of ['Small Rustic Fence', 'Small Rustic Fence_2', 'Small Rustic Fence_3', 'Small Rustic Fence_4', 'Rustic Fence Door']) {
    const entity = engine.getEntityOrNullByName(name)
    if (entity !== null) engine.removeEntity(entity)
  }
}

function buildSnake() {
  head = createSphere(START, Vector3.create(0.42, 0.3, 0.48), snakeSkins[0].head)
  eyes.push(createSphere(Vector3.create(START.x, -2, START.z), Vector3.create(0.09, 0.09, 0.09), Color4.White()))
  eyes.push(createSphere(Vector3.create(START.x, -2, START.z), Vector3.create(0.09, 0.09, 0.09), Color4.White()))
  eyes.push(createSphere(Vector3.create(START.x, -2, START.z), Vector3.create(0.038, 0.038, 0.038), Color4.fromHexString('#202044ff')))
  eyes.push(createSphere(Vector3.create(START.x, -2, START.z), Vector3.create(0.038, 0.038, 0.038), Color4.fromHexString('#202044ff')))
  for (let i = 0; i < INITIAL_LOCAL_SEGMENT_POOL; i++) {
    const segment = createDiamondBlock(
      Vector3.create(START.x, -2, START.z),
      Vector3.create(BODY_BLOCK_SIZE, BODY_BLOCK_SIZE, BODY_BLOCK_SIZE * BODY_BLOCK_OVERLAP),
      i % 2 === 0 ? snakeSkins[0].bodyA : snakeSkins[0].bodyB
    )
    segments.push(segment)
  }

  // Flattened, alpha-blended ellipses create a soft, pressed-sand impression.
  // The pool is large enough for a continuous two-minute trail without creating entities at runtime.
  for (let i = 0; i < SAND_STAMP_COUNT; i++) {
    const track = engine.addEntity()
    Transform.create(track, {
      position: Vector3.create(START.x, -2, START.z),
      // Planes are authored upright; rotate them down to hug the sand.
      rotation: Quaternion.fromEulerDegrees(90, 0, 0),
      scale: Vector3.create(0.52, 2.65, 1)
    })
    MeshRenderer.setPlane(track)
    Material.setPbrMaterial(track, {
      // The decal's alpha supplies the feather; 80% makes the pressed trail clearly readable.
      texture: Material.Texture.Common({ src: 'assets/images/sand-trail-brush.png' }),
      albedoColor: Color4.fromHexString('#ffffffcc'),
      transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
      roughness: 1,
      metallic: 0,
      castShadows: false
    })
    sandTracks.push({ entity: track, age: 0, active: false })
  }

  crownRoot = engine.addEntity()
  Transform.create(crownRoot, { position: Vector3.create(START.x, -2, START.z) })
  crownModel = engine.addEntity()
  Transform.create(crownModel, { parent: crownRoot, position: Vector3.Zero(), scale: Vector3.One() })
  GltfContainer.create(crownModel, { src: 'assets/Models/Crown-fitted.glb', visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })

  hatRoot = engine.addEntity()
  Transform.create(hatRoot, { position: Vector3.create(START.x, -2, START.z) })
  hatModel = engine.addEntity()
  Transform.create(hatModel, { parent: hatRoot, position: Vector3.Zero(), scale: Vector3.Zero() })
  GltfContainer.create(hatModel, { src: snakeHats[0].src, visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })

  rewardHatRoot = engine.addEntity()
  Transform.create(rewardHatRoot, { position: Vector3.create(START.x, -2, START.z) })
  rewardHatModel = engine.addEntity()
  Transform.create(rewardHatModel, { parent: rewardHatRoot, position: Vector3.Zero(), scale: Vector3.Zero() })
  GltfContainer.create(rewardHatModel, { src: snakeHats[0].src, visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })

  // Camera-facing identity badge. The portrait and name share one billboard so
  // they cannot drift apart or end up facing opposite directions.
  playerTagRoot = engine.addEntity()
  Transform.create(playerTagRoot, { position: Vector3.create(START.x, -2, START.z) })
  // Explicit camera-facing rotation keeps local +Z pointing toward the camera,
  // so the portrait always sits in front of its transparent backing.

  const portraitBackground = engine.addEntity()
  Transform.create(portraitBackground, {
    parent: playerTagRoot,
    position: Vector3.create(0, 0.39, -0.018),
    scale: Vector3.create(0.67, 0.67, 1)
  })
  MeshRenderer.setPlane(portraitBackground)
  Material.setPbrMaterial(portraitBackground, {
    texture: Material.Texture.Common({ src: 'assets/images/ui/portrait-black-rounded.png' }),
    albedoColor: Color4.White(),
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
    roughness: 1,
    metallic: 0,
    directIntensity: 0,
    specularIntensity: 0,
    castShadows: false
  })

  playerPortrait = engine.addEntity()
  Transform.create(playerPortrait, {
    parent: playerTagRoot,
    position: Vector3.create(0, 0.39, 0.06),
    scale: Vector3.create(0.54, 0.54, 0.54)
  })
  MeshRenderer.setPlane(playerPortrait)
  Material.setBasicMaterial(playerPortrait, {
    diffuseColor: Color4.White(),
    castShadows: false
  })

  playerNameLabel = engine.addEntity()
  Transform.create(playerNameLabel, {
    position: Vector3.create(START.x, -2, START.z),
    scale: Vector3.create(0.085, 0.085, 0.085)
  })
  // Keep TextShape and Billboard on the same entity. This is the SDK's native
  // floating-label path and avoids the mirrored child-transform result.
  Billboard.create(playerNameLabel, { billboardMode: BillboardMode.BM_ALL })
  TextShape.create(playerNameLabel, {
    text: playerDisplayName,
    fontSize: 23.4,
    width: 9,
    height: 0.9,
    textAlign: TextAlignMode.TAM_MIDDLE_CENTER,
    textColor: Color4.White(),
    outlineColor: Color3.Black(),
    outlineWidth: 0.12,
    shadowColor: Color3.Black(),
    shadowBlur: 0.08,
    shadowOffsetX: 0.025,
    shadowOffsetY: -0.025
  })

  chest = engine.addEntity()
  Transform.create(chest, { position: Vector3.create(START.x, -2, START.z), scale: Vector3.create(0.25, 0.25, 0.25) })
  GltfContainer.create(chest, { src: 'assets/Models/chest.glb', visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })
  Animator.create(chest, { states: [{ clip: 'open_chest', playing: false, loop: false }] })
}

function buildFood() {
  // The hosted server creates shared food. Clients render its accepted state.
}

function isFoodPositionOpen(candidate: Vector3, excluded?: Entity): boolean {
  for (const food of foods) {
    if (food === excluded) continue
    const current = Transform.get(food).position
    const dx = candidate.x - current.x
    const dz = candidate.z - current.z
    if (dx * dx + dz * dz < FOOD_MIN_SPACING_SQUARED) return false
  }
  return true
}

function randomOpenFoodPosition(excluded: Entity): Vector3 {
  let candidate = Vector3.create(2 + Math.random() * 28, FOOD_Y, 2 + Math.random() * 28)
  for (let attempt = 0; attempt < 32; attempt++) {
    if (isFoodPositionOpen(candidate, excluded)) return candidate
    candidate = Vector3.create(2 + Math.random() * 28, FOOD_Y, 2 + Math.random() * 28)
  }
  return candidate
}

function applyRemoteSkin(remote: RemoteSnake) {
  const skin = snakeSkins[Math.max(0, Math.min(snakeSkins.length - 1, remote.skin))]
  Material.setPbrMaterial(remote.head, { albedoColor: skin.head, roughness: 0.32, metallic: 0.04 })
  for (let i = 0; i < remote.segments.length; i++) {
    Material.setPbrMaterial(remote.segments[i], {
      albedoColor: i % 2 === 0 ? skin.bodyA : skin.bodyB,
      roughness: 0.36,
      metallic: 0.04
    })
  }
}

function createRemoteSnake(packet: SnakeStatePacket): RemoteSnake {
  const hidden = Vector3.create(START.x, -2, START.z)
  const remote: RemoteSnake = {
    playerId: packet.playerId,
    name: packet.name,
    phase: packet.phase,
    sequence: -1,
    heading: packet.heading,
    length: packet.length,
    score: packet.score,
    skin: packet.skin,
    hat: packet.hat,
    boosting: packet.boosting,
    lastSeen: uiElapsed,
    head: createSphere(hidden, Vector3.create(0.42, 0.3, 0.48), snakeSkins[packet.skin]?.head ?? snakeSkins[0].head),
    eyes: [],
    segments: [],
    label: engine.addEntity(),
    targetPoints: [],
    displayHead: Vector3.clone(hidden)
  }
  for (let i = 0; i < 4; i++) {
    remote.eyes.push(createSphere(hidden, Vector3.create(i < 2 ? 0.09 : 0.038, i < 2 ? 0.09 : 0.038, i < 2 ? 0.09 : 0.038), i < 2 ? Color4.White() : Color4.fromHexString('#202044ff')))
  }
  Transform.create(remote.label, { position: hidden, scale: Vector3.create(0.075, 0.075, 0.075) })
  Billboard.create(remote.label, { billboardMode: BillboardMode.BM_ALL })
  TextShape.create(remote.label, {
    text: packet.name.slice(0, 24), fontSize: 18, width: 10, height: 1,
    textAlign: TextAlignMode.TAM_MIDDLE_CENTER, textColor: Color4.White(),
    outlineColor: Color3.Black(), outlineWidth: 0.14
  })
  remoteSnakes.set(packet.playerId, remote)
  return remote
}

function ensureRemoteSegmentCapacity(remote: RemoteSnake, required: number) {
  const safeRequired = Math.min(REMOTE_RENDER_SEGMENTS, Math.max(0, required))
  while (remote.segments.length > safeRequired) {
    const entity = remote.segments.pop()
    if (entity !== undefined) engine.removeEntity(entity)
  }
  const skin = snakeSkins[remote.skin] ?? snakeSkins[0]
  while (remote.segments.length < safeRequired) {
    const index = remote.segments.length
    remote.segments.push(createDiamondBlock(
      Vector3.create(START.x, -2, START.z),
      Vector3.create(BODY_BLOCK_SIZE, BODY_BLOCK_SIZE, BODY_BLOCK_SIZE * BODY_BLOCK_OVERLAP),
      index % 2 === 0 ? skin.bodyA : skin.bodyB
    ))
  }
}

function hideRemoteSnake(remote: RemoteSnake) {
  Transform.getMutable(remote.head).position.y = -2
  Transform.getMutable(remote.label).position.y = -2
  for (const entity of remote.eyes) Transform.getMutable(entity).position.y = -2
  for (const entity of remote.segments) Transform.getMutable(entity).position.y = -2
}

function removeRemoteSnake(playerId: string) {
  const remote = remoteSnakes.get(playerId)
  if (!remote) return
  for (const entity of [remote.head, remote.label, ...remote.eyes, ...remote.segments]) engine.removeEntity(entity)
  remoteSnakes.delete(playerId)
}

function readNetworkPoint(point: NetworkPoint): Vector3 | null {
  if (!point || typeof point.x !== 'number' || typeof point.z !== 'number') return null
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return null
  return Vector3.create(
    Math.max(ARENA_MIN - 1, Math.min(ARENA_MAX + 1, point.x)),
    START.y,
    Math.max(ARENA_MIN - 1, Math.min(ARENA_MAX + 1, point.z))
  )
}

function receiveSnakeState(value: unknown, sender: string) {
  if (sender === 'self' || !value || typeof value !== 'object') return
  const packet = value as SnakeStatePacket
  if (!packet.playerId || packet.playerId === networkPlayerId || !Array.isArray(packet.points)) return
  if (!Number.isFinite(packet.sequence) || !Number.isFinite(packet.length) || !Number.isFinite(packet.skin)) return
  if (!['ready', 'running', 'gameover', 'exited'].includes(packet.phase)) return
  if (typeof packet.playerId !== 'string' || !Number.isFinite(packet.score)) return
  if (!lifecycle.accept(packet.playerId, packet, packet.phase === 'gameover' || packet.phase === 'exited')) return
  let remote = remoteSnakes.get(packet.playerId)
  if (!remote) remote = createRemoteSnake({ ...packet, name: String(packet.name || 'PLAYER') })

  const oldSkin = remote.skin
  const wasRunning = remote.phase === 'running'
  if (wasRunning && packet.phase === 'gameover') playEnemyDeathSound()
  remote.name = String(packet.name || 'PLAYER').slice(0, 24)
  remote.phase = packet.phase
  remote.sequence = packet.sequence
  remote.heading = Number.isFinite(packet.heading) ? packet.heading : 0
  remote.length = Math.max(5, Math.floor(packet.length))
  remote.score = Math.max(0, Math.floor(packet.score))
  remote.skin = Math.max(0, Math.min(snakeSkins.length - 1, Math.floor(packet.skin)))
  remote.hat = Number.isFinite(packet.hat) ? Math.floor(packet.hat) : -1
  remote.boosting = packet.boosting === true
  remote.lastSeen = uiElapsed
  if (!remote.track || remote.run !== packet.run || remote.session !== packet.session) remote.track = new SnapshotTrack()
  remote.run = packet.run; remote.session = packet.session
  if (packet.sampleTime) {
    remote.track.push({ at: packet.sampleTime, points: packet.points, heading: packet.heading, speed: packet.speed || 0 })
    presentationClock.observe(packet.sampleTime, Date.now())
  }
  remote.sampleTime = packet.sampleTime
  remote.speed = packet.speed
  // Reject a broken trail as a whole: filtering points would bridge across
  // the missing geometry with an invisible lethal chord.
  const points = packet.points.slice(0, NETWORK_TRAIL_SAMPLES).map(readNetworkPoint)
  remote.targetPoints = points.every((point): point is Vector3 => point !== null) ? points : []
  if ((!wasRunning || remote.displayHead.y < 0) && remote.targetPoints.length > 0) remote.displayHead = Vector3.clone(remote.targetPoints[0])
  TextShape.getMutable(remote.label).text = remote.name
  if (oldSkin !== remote.skin) applyRemoteSkin(remote)
  if (remote.phase !== 'running' || remote.targetPoints.length < 2) hideRemoteSnake(remote)
}

function receiveSnakeDeath(value: unknown, sender: string) {
  if (sender === 'self' || !value || typeof value !== 'object') return
  const event = value as SnakeDeathPacket
  if (typeof event.victimId !== 'string' || !event.victimId || event.victimId === networkPlayerId) return
  if (![event.session, event.run, event.sequence].every(n => Number.isSafeInteger(n) && n >= 0)) return
  // Death is an immediate gameplay event. Clear the victim trail before any
  // older queued movement packet can leave a lethal "ghost snake" over food.
  const accepted = lifecycle.accept(event.victimId, event, true)
  const victim = accepted ? remoteSnakes.get(event.victimId) : undefined
  if (victim) {
    victim.phase = 'gameover'
    victim.targetPoints = []
    victim.sequence = Math.max(victim.sequence, Number.isFinite(event.sequence) ? event.sequence : victim.sequence)
    victim.lastSeen = uiElapsed
    hideRemoteSnake(victim)
  }
  const deathKey = `${event.victimId}:${event.session}:${event.run}`
  if (processedDeaths.has(deathKey)) return
  processedDeaths.add(deathKey)
  playEnemyDeathSound()
  if (event.killerId && event.killerId === networkPlayerId) {
    matchKills += 1
    broadcastSnakeState(true)
  }
}

const networkClock = new NetworkClock()
let currentTurn = 0, lastPing = 0, ownRevision = -1, ownRevisionRun = -1
const ownTrack = new SnapshotTrack()
const presentationClock = new PresentationClock()
let requestedBoost = false
let pointerTurnIntegral = 0, pointerSampleSeconds = 0
function applyServerPacket(packet: SnakeStatePacket & { motion?: Motion; ack?: number; earned?: number; killerId?: string; deathReason?: string }) {
  if (packet.playerId === networkPlayerId && packet.session === networkSession && packet.run === runsStarted) {
    if (ownRevisionRun !== runsStarted) { ownRevision = -1; ownRevisionRun = runsStarted }
    if (packet.sequence <= ownRevision) return
    ownRevision = packet.sequence
    if (packet.phase === 'gameover' && phase === 'running') {
      endRun(packet.deathReason || 'Head collision', packet.killerId || '', false)
    } else if (packet.phase === 'running' && phase === 'running' && packet.motion && Transform.has(head)) {
      // Network callbacks only enqueue confirmed poses. They never move rendered entities.
      const at = packet.sampleTime || Date.now()
      ownTrack.push({ at, points: packet.points, heading: packet.motion.heading, speed: packet.speed || 0 })
      presentationClock.observe(at, Date.now())
      boostSpent = packet.motion.spent; boostTimer = packet.motion.boostTimer
      boostingActive = packet.boosting === true

    }
  }
  receiveSnakeState(packet, 'server')
}
function setupMultiplayer() {
  if (multiplayerReady) return
  multiplayerReady = true
  room.onMessage('arenaFrames', message => {
    if (message.epoch !== serverConnection().epoch) return
    for (const payload of message.frames) {
      try { applyServerPacket(JSON.parse(payload)) } catch { /* Ignore malformed frames. */ }
    }
  })
  room.onMessage('pong', message => networkClock.accept(message.sentAt, message.serverAt, Date.now()))
}

function renderOwnSnake(dt = 1 / 60) {
  const displayed = ownTrack.sample(presentationClock.time)
  if (!displayed?.points.length || !Transform.has(head)) return
  const transform = Transform.getMutable(head)
  const target = displayed.points[0]
  const dx = target.x - transform.position.x, dz = target.z - transform.position.z
  // Confirmed snapshots remain the only target. This small presentation-only
  // follower absorbs packet quantization instead of replacing the visible
  // head and whole trail at each arrival.
  if (!positionTrail.length || dx * dx + dz * dz > 2.25) {
    transform.position.x = target.x; transform.position.z = target.z
    positionTrail.splice(0, positionTrail.length, ...displayed.points.map(p => Vector3.create(p.x, START.y, p.z)))
  } else {
    const follow = 1 - Math.exp(-Math.min(.05, Math.max(0, dt)) * 20)
    transform.position.x += dx * follow
    transform.position.z += dz * follow
  }
  const headingDelta = Math.atan2(Math.sin(displayed.heading - heading), Math.cos(displayed.heading - heading))
  heading += headingDelta * (1 - Math.exp(-Math.min(.05, Math.max(0, dt)) * 18))
}

const receivedSnapshots = new Map<Entity, { epoch: number; payload: string; playerId: string }>()
function receiveServerSnakes() {
  const activeEpoch = serverConnection().epoch
  const seen = new Set<Entity>()
  for (const [entity, snapshot] of engine.getEntitiesWith(SnakeSnapshot)) {
    if (snapshot.epoch !== activeEpoch) continue
    seen.add(entity)
    const previous = receivedSnapshots.get(entity)
    if (previous?.epoch === snapshot.epoch && previous.payload === snapshot.payload) continue
    try {
      const packet = JSON.parse(snapshot.payload) as SnakeStatePacket
      if (previous && (previous.epoch !== snapshot.epoch || previous.playerId !== packet.playerId)) removeRemoteSnake(previous.playerId)
      applyServerPacket(packet)
      receivedSnapshots.set(entity, { ...snapshot, playerId: packet.playerId })
    } catch (error) { console.error('[Snake Cluster] Invalid server snake snapshot', error) }
  }
  for (const [entity, previous] of receivedSnapshots) {
    if (seen.has(entity)) continue
    removeRemoteSnake(previous.playerId)
    receivedSnapshots.delete(entity)
  }
  // CRDT components may arrive in different frames. Remains are also durable
  // proof of death: clear the victim before its food can overlap a lethal body.
  for (const [, food] of engine.getEntitiesWith(SharedFood)) {
    if (food.epoch !== activeEpoch || !food.dropped || !food.ownerId) continue
    receiveSnakeDeath({ victimId: food.ownerId, killerId: '', session: food.session,
      run: food.run, sequence: food.sequence }, 'server-remains')
  }
}

function sampledLocalTrail(): NetworkPoint[] {
  if (!Transform.has(head)) return []
  const shown = renderedSegmentCount
  const points: NetworkPoint[] = []
  const headPosition = Transform.get(head).position
  points.push({ x: Math.round(headPosition.x * 100) / 100, z: Math.round(headPosition.z * 100) / 100 })
  if (shown <= 0) return points
  const sampleCount = Math.min(NETWORK_TRAIL_SAMPLES - 1, shown)
  for (let sample = 0; sample < sampleCount; sample++) {
    const index = Math.min(shown - 1, Math.round((sample / Math.max(1, sampleCount - 1)) * (shown - 1)))
    const position = Transform.get(segments[index]).position
    points.push({ x: Math.round(position.x * 100) / 100, z: Math.round(position.z * 100) / 100 })
  }
  return points
}

function broadcastSnakeState(force = false) {
  if (!networkPlayerId || !multiplayerReady) return
  if (!force && networkSendTimer > 0.000001) return
  networkSendTimer = phase === 'running' ? NETWORK_SEND_INTERVAL : NETWORK_IDLE_INTERVAL
  const packet = {
    session: networkSession,
    run: runsStarted,
    playerId: networkPlayerId,
    name: playerDisplayName,
    phase,
    sequence: ++networkSequence,
    heading,
    steer: currentTurn,
    mobile: isMobile(),
    pointerTurn: pointerSampleSeconds > 0 ? pointerTurnIntegral / pointerSampleSeconds : 0,
    length: visibleSegmentCount(),
    score: visibleSegmentCount() + matchKills * 10,
    skin: selectedSkin,
    hat: equippedHat,
    boosting: requestedBoost,
    spent: boostSpent,
    points: [], // Inputs only; the server owns all positions and trails.
    killerId: phase === 'gameover' ? lastKillerId : '',
    deathReason: phase === 'gameover' ? lastDeathReason : ''
  }
  // Presence and pickup claims can be sent as soon as the CRDT transport is
  // synchronized. Do not gate them on the UI heartbeat, otherwise a newly
  // joined player can see food but remain unable to collect it.
  if (isStateSyncronized()) void room.send('snakePresence', { payload: JSON.stringify(packet) })
  pointerTurnIntegral = 0; pointerSampleSeconds = 0
}

function pointOnRemoteTrail(points: Vector3[], progress: number): Vector3 {
  if (points.length === 0) return Vector3.create(START.x, -2, START.z)
  if (points.length === 1) return Vector3.clone(points[0])
  const scaled = Math.max(0, Math.min(1, progress)) * (points.length - 1)
  const fromIndex = Math.floor(scaled)
  const toIndex = Math.min(points.length - 1, fromIndex + 1)
  const amount = scaled - fromIndex
  const from = points[fromIndex]
  const to = points[toIndex]
  return Vector3.create(from.x + (to.x - from.x) * amount, START.y, from.z + (to.z - from.z) * amount)
}

function updateRemoteSnakes(dt: number) {
  const removeIds: string[] = []
  // Share a fixed remote-body budget across however many players are present.
  // Nearby gameplay remains readable without an artificial player cap.
  const remoteSegmentBudget = Math.max(10, Math.min(REMOTE_RENDER_SEGMENTS, Math.floor(192 / Math.max(1, remoteSnakes.size))))
  for (const remote of remoteSnakes.values()) {
    const age = uiElapsed - remote.lastSeen
    if (age > REMOTE_REMOVE_SECONDS) { removeIds.push(remote.playerId); continue }
    if (age > REMOTE_STALE_SECONDS || remote.phase !== 'running' || remote.targetPoints.length < 2) {
      hideRemoteSnake(remote)
      continue
    }

    const sampled = remote.track?.sample(presentationClock.time)
    const predicted = sampled ? sampled.points.map(p => Vector3.create(p.x, START.y, p.z)) : remote.targetPoints
    if (sampled) remote.heading = sampled.heading
    const follow = 1 // The shared snapshot clock already interpolates the full body.
    remote.displayHead = Vector3.clone(predicted[0])
    const headTransform = Transform.getMutable(remote.head)
    headTransform.position = Vector3.clone(remote.displayHead)
    headTransform.rotation = Quaternion.fromEulerDegrees(0, remote.heading * 180 / Math.PI, 0)

    const visible = Math.min(remote.length - 1, remoteSegmentBudget)
    ensureRemoteSegmentCapacity(remote, visible)
    for (let i = 0; i < remote.segments.length; i++) {
      const segmentTransform = Transform.getMutable(remote.segments[i])
      if (i >= visible) { segmentTransform.position.y = -2; continue }
      const target = pointOnRemoteTrail(predicted, (i + 1) / Math.max(1, visible))
      const neighborProgress = i + 1 < visible
        ? (i + 2) / Math.max(1, visible)
        : i / Math.max(1, visible)
      const nextTarget = pointOnRemoteTrail(predicted, neighborProgress)
      const segmentFollow = segmentTransform.position.y < 0 ? 1 : follow
      segmentTransform.position.x += (target.x - segmentTransform.position.x) * segmentFollow
      segmentTransform.position.y = START.y
      segmentTransform.position.z += (target.z - segmentTransform.position.z) * segmentFollow
      const direction = i + 1 < visible ? 1 : -1
      const dx = (nextTarget.x - target.x) * direction
      const dz = (nextTarget.z - target.z) * direction
      const distance = Math.sqrt(dx * dx + dz * dz)
      if (distance > 0.001) {
        const yaw = Math.atan2(dx, dz) * 180 / Math.PI
        segmentTransform.rotation = Quaternion.multiply(Quaternion.fromEulerDegrees(0, yaw, 0), DIAMOND_TILT)
      }
      const taper = bodyTaper(i, visible)
      segmentTransform.scale = Vector3.create(
        BODY_BLOCK_SIZE * taper,
        BODY_BLOCK_SIZE * taper,
        Math.max(BODY_BLOCK_SIZE * BODY_BLOCK_OVERLAP, distance * BODY_BLOCK_OVERLAP) * Math.max(0.9, taper)
      )
    }

    const forward = Vector3.create(Math.sin(remote.heading), 0, Math.cos(remote.heading))
    const right = Vector3.create(Math.cos(remote.heading), 0, -Math.sin(remote.heading))
    for (let eyeIndex = 0; eyeIndex < 4; eyeIndex++) {
      const side = eyeIndex % 2 === 0 ? -1 : 1
      const pupil = eyeIndex >= 2
      Transform.getMutable(remote.eyes[eyeIndex]).position = Vector3.create(
        remote.displayHead.x + forward.x * (pupil ? 0.205 : 0.17) + right.x * 0.135 * side,
        0.35,
        remote.displayHead.z + forward.z * (pupil ? 0.205 : 0.17) + right.z * 0.135 * side
      )
    }
    Transform.getMutable(remote.label).position = Vector3.create(remote.displayHead.x, 0.98, remote.displayHead.z)
  }
  for (const playerId of removeIds) removeRemoteSnake(playerId)
}

function createGlobalAudio(clip: string, volume: number, loop = false, playing = false): Entity {
  const audio = engine.addEntity()
  Transform.create(audio, { position: Vector3.clone(START) })
  AudioSource.create(audio, {
    audioClipUrl: clip,
    playing,
    loop,
    volume,
    global: true
  })
  return audio
}

function buildAudio() {
  // One persistent global source owns the soundtrack for the entire scene.
  // It is never retriggered on death, menus, respawn, or music toggles, so the
  // playback cursor cannot duplicate, restart, or get stuck between states.
  themeAudio = createGlobalAudio(THEME_AUDIO, 0.18, true, true)
  for (let i = 0; i < 4; i++) eatAudioPool.push(createGlobalAudio(EAT_AUDIO, 0.48))
  enemyDeathAudio = createGlobalAudio(ENEMY_DEATH_AUDIO, 0.54)
  deathAudio = createGlobalAudio(DEATH_AUDIO, 0.72)
  uiClickAudio = createGlobalAudio(UI_CLICK_AUDIO, 0.32)
}

function ensureThemePlaying() {
  // Keep the same looping AudioSource alive; only its volume is toggled.
  updateAudio()
}

function playEatSound() {
  if (!soundEnabled || eatCooldown > 0) return
  eatCooldown = 0.065
  const audio = eatAudioPool[nextEatAudio]
  nextEatAudio = (nextEatAudio + 1) % eatAudioPool.length
  // A small pitch range keeps rapid collection streaks lively without making
  // the cue unrecognizable. The pool prevents one pickup cutting off another.
  AudioSource.getMutable(audio).pitch = 0.95 + Math.random() * 0.1
  AudioSource.playSound(audio, EAT_AUDIO)
}

/** Call from a confirmed remote death event when multiplayer is connected. */
export function playEnemyDeathSound() {
  if (soundEnabled && !EngineInfo.getOrNull(engine.RootEntity)?.sceneHidden) AudioSource.playSound(enemyDeathAudio, ENEMY_DEATH_AUDIO)
}

/** UI actions share one global, retriggerable official Decentraland click. */
export function playUiClickSound() {
  if (soundEnabled && !EngineInfo.getOrNull(engine.RootEntity)?.sceneHidden) AudioSource.playSound(uiClickAudio, UI_CLICK_AUDIO)
}

export function toggleMusic() {
  musicEnabled = !musicEnabled
  ensureThemePlaying()
}

export function toggleSound() {
  soundEnabled = !soundEnabled
  if (!soundEnabled) for (const entity of [...eatAudioPool, deathAudio, enemyDeathAudio, uiClickAudio]) AudioSource.getMutable(entity).playing = false
}

function updateAudio(dt = 0) {
  eatCooldown = Math.max(0, eatCooldown - dt)
  const audible = musicEnabled && !EngineInfo.getOrNull(engine.RootEntity)?.sceneHidden
  // Never write playing=false and never call playSound for the theme. Muting
  // preserves the playback cursor, so returning from menus/death is seamless.
  const targetVolume = audible ? 0.18 : 0
  if (targetVolume !== appliedThemeVolume) {
    AudioSource.getMutable(themeAudio).volume = targetVolume
    appliedThemeVolume = targetVolume
  }
}

const AVATAR_HIDE_AREA = Vector3.create(ARENA_MAX - ARENA_MIN, 24, ARENA_MAX - ARENA_MIN)

function activateSnakeMode() {
  MainCamera.createOrReplace(engine.CameraEntity, { virtualCameraEntity: camera })
  PointerLock.createOrReplace(engine.CameraEntity, { isPointerLocked: false })
  InputModifier.createOrReplace(engine.PlayerEntity, {
    mode: InputModifier.Mode.Standard({
      disableWalk: true,
      disableJog: true,
      disableRun: true,
      disableJump: true,
      disableDoubleJump: true,
      disableGliding: true,
      disableEmote: true
    })
  })
  TouchScreenControls.createOrReplace(engine.RootEntity, {
    hideJoystick: false,
    hideCrosshair: true,
    mainAction: InputAction.IA_PRIMARY,
    touchInputs: [
      { inputAction: InputAction.IA_JUMP, hide: true },
      { inputAction: InputAction.IA_POINTER, hide: true },
      { inputAction: InputAction.IA_PRIMARY, hide: false, icon: { tex: { $case: 'texture', texture: { src: 'assets/images/ui/boost-up.png' } } } },
      { inputAction: InputAction.IA_SECONDARY, hide: true },
      { inputAction: InputAction.IA_ACTION_3, hide: true },
      { inputAction: InputAction.IA_ACTION_4, hide: true },
      { inputAction: InputAction.IA_ACTION_5, hide: true },
      { inputAction: InputAction.IA_ACTION_6, hide: true }
    ]
  })
  AvatarModifierArea.createOrReplace(avatarHider, {
    area: AVATAR_HIDE_AREA,
    modifiers: [AvatarModifierType.AMT_HIDE_AVATARS],
    excludeIds: []
  })
}

function setupCamera() {
  camera = engine.addEntity()
  Transform.create(camera, {
    position: Vector3.create(16, 3.8, 10),
    rotation: Quaternion.fromLookAt(Vector3.create(16, 3.8, 10), START)
  })
  VirtualCamera.create(camera, { fov: 58 })

  avatarHider = engine.addEntity()
  // Match the explicit area and transform size for both client renderers.
  Transform.create(avatarHider, {
    position: Vector3.create(16, 12, 16),
    scale: AVATAR_HIDE_AREA
  })
  activateSnakeMode()
}

export function createSnakeExperiment() {
  removeAuthoredFencePlaceholders()
  buildArena()
  buildSnake()
  buildFood()
  buildAudio()
  setupCamera()
  setupMultiplayer()
  showSnake(false)
}

function visibleSegmentCount(): number {
  return Math.max(5, START_SEGMENTS + runEnergy - boostSpent)
}

function bodyTaper(index: number, visible: number): number {
  const taperCount = Math.min(TAIL_TAPER_SEGMENTS, Math.max(4, Math.floor(visible * 0.28)))
  const taperStart = Math.max(0, visible - taperCount)
  if (index < taperStart) return 1
  const progress = (index - taperStart) / Math.max(1, taperCount - 1)
  const smoothProgress = progress * progress * (3 - 2 * progress)
  return 1 - (1 - TAIL_MIN_SCALE) * smoothProgress
}

function ensureSegmentCapacity(required: number) {
  // Gameplay length remains unbounded; rendering uses a fixed-budget pool so
  // one long snake cannot consume the whole 2x2 scene entity allowance.
  while (segments.length < Math.min(required, MAX_LOCAL_RENDER_SEGMENTS)) {
    const index = segments.length
    segments.push(createDiamondBlock(
      Vector3.create(START.x, -2, START.z),
      Vector3.create(BODY_BLOCK_SIZE, BODY_BLOCK_SIZE, BODY_BLOCK_SIZE * BODY_BLOCK_OVERLAP),
      index % 2 === 0 ? snakeSkins[selectedSkin].bodyA : snakeSkins[selectedSkin].bodyB
    ))
  }
}

function showSnake(visible: boolean) {
  renderedSegmentCount = 0
  Transform.getMutable(head).position = visible ? Vector3.clone(runSpawn) : Vector3.create(START.x, -2, START.z)
  Transform.getMutable(playerTagRoot).position.y = -2
  Transform.getMutable(playerNameLabel).position.y = -2
  for (const segment of segments) Transform.getMutable(segment).position.y = -2
  for (const eye of eyes) Transform.getMutable(eye).position.y = -2
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function chooseRunSpawn(): { position: Vector3, heading: number } {
  // Continuous hash-derived slots avoid a finite spawn table and let any
  // number of peers jump into a running arena without stacking at the centre.
  const seed = stableHash(`${networkPlayerId || profileUserId || playerDisplayName}:${runsStarted}`)
  const normalized = seed / 0xffffffff
  const angle = normalized * Math.PI * 2
  const radius = 9.5 + ((seed >>> 8) % 180) / 100
  const position = Vector3.create(16 + Math.sin(angle) * radius, START.y, 16 + Math.cos(angle) * radius)
  const clockwise = (seed & 1) === 0
  return { position, heading: angle + (clockwise ? Math.PI / 2 : -Math.PI / 2) }
}

function refreshPlayerProfile() {
  const player = getPlayer()
  if (!player) return

  const resolvedName = player.name.trim().slice(0, 24)
  if (resolvedName && resolvedName !== playerDisplayName) {
    playerDisplayName = resolvedName
    TextShape.getMutable(playerNameLabel).text = playerDisplayName
    const nameScale = Math.max(0.044, Math.min(0.085, 0.085 * (10 / Math.max(10, playerDisplayName.length))))
    Transform.getMutable(playerNameLabel).scale = Vector3.create(nameScale, nameScale, nameScale)
  }

  if (player.userId && player.userId !== profileUserId) {
    profileUserId = player.userId
    networkPlayerId = `${profileUserId}:${networkSessionNonce}`
    Material.setBasicMaterial(playerPortrait, {
      texture: Material.Texture.Avatar({ userId: profileUserId }),
      diffuseColor: Color4.White(),
      castShadows: false
    })
  }
}

function updatePlayerTag(headPosition: Vector3) {
  const tag = Transform.getMutable(playerTagRoot)
  const name = Transform.getMutable(playerNameLabel)
  if (chestSequence !== 'idle') {
    tag.position.y = -2
    name.position.y = -2
    return
  }

  const bob = Math.sin(uiElapsed * 2.8) * 0.045
  tag.position = Vector3.create(
    headPosition.x,
    1.24 + bob,
    headPosition.z
  )
  const cameraPosition = Transform.get(camera).position
  tag.rotation = Quaternion.fromLookAt(tag.position, cameraPosition)
  const cameraDx = cameraPosition.x - headPosition.x
  const cameraDz = cameraPosition.z - headPosition.z
  const cameraDistance = Math.max(0.001, Math.sqrt(cameraDx * cameraDx + cameraDz * cameraDz))
  name.position = Vector3.create(
    headPosition.x + (cameraDx / cameraDistance) * 0.055,
    1.245 + bob,
    headPosition.z + (cameraDz / cameraDistance) * 0.055
  )
}

function updateFace(headPosition: Vector3) {
  const forward = Vector3.create(Math.sin(heading), 0, Math.cos(heading))
  const right = Vector3.create(Math.cos(heading), 0, -Math.sin(heading))
  const lateral = 0.135
  const eyeForward = 0.17
  const pupilForward = 0.205
  for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
    const side = sideIndex === 0 ? -1 : 1
    Transform.getMutable(eyes[sideIndex]).position = Vector3.create(
      headPosition.x + forward.x * eyeForward + right.x * lateral * side,
      0.35,
      headPosition.z + forward.z * eyeForward + right.z * lateral * side
    )
    Transform.getMutable(eyes[sideIndex + 2]).position = Vector3.create(
      headPosition.x + forward.x * pupilForward + right.x * lateral * side,
      0.35,
      headPosition.z + forward.z * pupilForward + right.z * lateral * side
    )
  }
}

export function startRun() {
  ensureThemePlaying()
  if (!serverConnection().ready) { waitingToStart = true; return }
  waitingToStart = false
  refreshPlayerProfile()
  phase = 'running'
  runsStarted += 1
  runEnergy = 0
  lastDeathPoints = []; lastKillerId = ''; lastDeathReason = ''
  pendingFoodClaims.clear()
  matchKills = 0
  boostSpent = 0
  boostTimer = 0
  boostUsed = false
  boostingActive = false
  currentRunElapsed = 0
  const spawn = chooseRunSpawn()
  runSpawn = spawn.position
  heading = spawn.heading
  cameraRig.reset(Transform.get(camera).position, runSpawn, heading)
  PointerLock.getMutable(engine.CameraEntity).isPointerLocked = false
  menuOpen = false
  resultMessage = 'Hold left click and drag to steer. Press F to boost.'
  ownTrack.clear()
  currentTurn = 0; requestedBoost = false; pointerTurnIntegral = 0; pointerSampleSeconds = 0
  positionTrail.length = 0
  showSnake(true)
  for (let i = 0; i < 120; i++) {
    positionTrail.push(Vector3.create(
      runSpawn.x - Math.sin(heading) * i * 0.03,
      runSpawn.y,
      runSpawn.z - Math.cos(heading) * i * 0.03
    ))
  }
  updateTrail(Transform.get(head).position)
  broadcastSnakeState(true)
  if (!testStarted) {
    testStarted = true
    testElapsed = 0
  }
  console.log(`[H1-01] run-start count=${runsStarted} elapsed=${testElapsed.toFixed(1)}`)
}

/** Exit the snake mode and restore the normal player at the scene spawn. */
export function leaveGame() {
  waitingToStart = false
  phase = 'exited'
  exitedArenaOnce = false
  menuOpen = false
  boostingActive = false
  showSnake(false)
  Transform.getMutable(crownRoot).position.y = -2
  Transform.getMutable(hatRoot).position.y = -2
  Transform.getMutable(rewardHatRoot).position.y = -2

  // The avatar never leaves the default scene spawn while the virtual snake
  // camera is active. That spawn is outside the west/south fence, so restoring
  // the normal camera and locomotion puts the player exactly where requested
  // without an unreliable Transform write or an extra teleport permission.
  MainCamera.deleteFrom(engine.CameraEntity)
  InputModifier.deleteFrom(engine.PlayerEntity)
  TouchScreenControls.deleteFrom(engine.RootEntity)
  // Keep the arena hidden for every observer, including players who leave.
  // The exit strip at x=0.12 is outside this permanent arena-sized area.
  broadcastSnakeState(true)

  // Move to the narrow public strip west of the arena wall while staying
  // inside the 2x2 scene bounds. Face back toward the game so the exit feels
  // intentional and the arena remains easy to recognize.
  void movePlayerTo({
    newRelativePosition: Vector3.create(0.12, 0.15, 16),
    cameraTarget: Vector3.create(4, 1, 16),
    avatarTarget: Vector3.create(4, 1, 16)
  })
}

function returnToGameMenu() {
  phase = 'ready'
  menuOpen = true
  exitedArenaOnce = false
  menuSession += 1
  resultMessage = 'Choose your snake and enter the arena'
  showSnake(false)

  const cameraTransform = Transform.getMutable(camera)
  cameraTransform.position = Vector3.create(16, 3.8, 10)
  cameraTransform.rotation = Quaternion.fromLookAt(cameraTransform.position, START)
  activateSnakeMode()
  broadcastSnakeState(true)
}

function endRun(reason: string, killerId = '', report = true) {
  if (phase !== 'running') return
  lastDeathPoints = sampledLocalTrail()
  lastKillerId = killerId
  lastDeathReason = reason
  // Announce the terminal life before publishing the food that replaces it.
  phase = 'gameover'
  const deathSequence = ++networkSequence
  if (networkPlayerId && report) {
    void room.send('snakeDeath', { payload: JSON.stringify({ victimId: networkPlayerId, killerId, session: networkSession, run: runsStarted, sequence: deathSequence, points: lastDeathPoints, reason }) })
  }
  broadcastSnakeState(true)
  // Food is spawned by the server once for this death, never once per client.
  if (soundEnabled) AudioSource.playSound(deathAudio, DEATH_AUDIO)
  showSnake(false)
  Transform.getMutable(crownRoot).position.y = -2
  Transform.getMutable(hatRoot).position.y = -2
  boostingActive = false
  resultMessage = `You died — ${reason}`
  console.log(`[H1-01] collision reason=${reason} run=${runsStarted} elapsed=${testElapsed.toFixed(1)} energy=${runEnergy}`)
}

export function setSkin(index: number) {
  ensureThemePlaying()
  if (index < 0 || index >= snakeSkins.length) return
  if (!isSkinUnlocked(index)) return
  selectedSkin = index
  const skin = snakeSkins[index]
  Material.setPbrMaterial(head, { albedoColor: skin.head, roughness: 0.32, metallic: 0.04 })
  for (let i = 0; i < segments.length; i++) {
    Material.setPbrMaterial(segments[i], {
      albedoColor: i % 2 === 0 ? skin.bodyA : skin.bodyB,
      roughness: 0.36,
      metallic: 0.04
    })
  }
}

export function isSkinUnlocked(index: number): boolean {
  const skin = snakeSkins[index]
  return !skin.special || energyCollected >= (skin.unlockAt ?? Number.MAX_SAFE_INTEGER)
}

export function dismissUnlock() {
  newlyUnlockedSkin = -1
  newlyUnlockedHat = -1
}

export function isHatOwned(index: number): boolean { return ownedHats[index] === true }

export function equipHat(index: number) {
  ensureThemePlaying()
  if (!isHatOwned(index)) return
  equippedHat = index
  const config = snakeHats[index]
  GltfContainer.getMutable(hatModel).src = config.src
  const t = Transform.getMutable(hatModel)
  t.position = config.offset
  const scale = config.scale * (isMobile() ? MOBILE_HEADWEAR_SCALE : 1)
  t.scale = Vector3.create(scale, scale, scale)
}

export function matchLeaderboard(): LeaderboardRow[] {
  const rows: LeaderboardRow[] = []
  const epoch = serverConnection().epoch
  for (const [, player] of engine.getEntitiesWith(MatchPlayer)) {
    if (player.epoch !== epoch) continue
    rows.push({ name: player.name, score: player.score, player: player.address.toLowerCase() === profileUserId.toLowerCase(), playerId: player.playerId })
  }
  return rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}

export function globalLeaderboard(): LeaderboardRow[] {
  const epoch = serverConnection().epoch
  return [...engine.getEntitiesWith(SavedScore)]
    .filter(([, row]) => row.epoch === epoch && row.score > 0)
    .map(([, row]) => ({ name: row.name, score: row.score, player: row.address.toLowerCase() === profileUserId.toLowerCase(), playerId: row.address }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}

function crownLeader() {
  const epoch = serverConnection().epoch
  return longestLiving([...engine.getEntitiesWith(MatchPlayer)]
    .filter(([, row]) => row.epoch === epoch)
    .map(([, row]) => ({ playerId: row.playerId, phase: row.phase, length: row.length,
      player: row.playerId === networkPlayerId })))
}

function playerLeadsMatch(): boolean {
  return crownLeader()?.player === true
}

function updateCrown(headPosition: Vector3) {
  const platform = getPlatform()
  const leader = crownLeader()
  const remoteLeader = leader && !leader.player ? remoteSnakes.get(leader.playerId) : undefined
  const visible = platform !== null && ((leader?.player === true && phase === 'running') ||
    (remoteLeader?.phase === 'running' && uiElapsed - remoteLeader.lastSeen <= REMOTE_STALE_SECONDS))
  if (!visible) {
    Transform.getMutable(crownRoot).position.y = -2
    return
  }
  const scale = platform === 'mobile' ? MOBILE_HEADWEAR_SCALE : 1
  if (Transform.get(crownModel).scale.x !== scale) {
    Transform.getMutable(crownModel).scale = Vector3.create(scale, scale, scale)
  }
  const crownTransform = Transform.getMutable(crownRoot)
  const crownPosition = remoteLeader?.displayHead ?? headPosition
  const crownHeading = remoteLeader?.heading ?? heading
  crownTransform.position = Vector3.create(crownPosition.x, 0.5, crownPosition.z)
  crownTransform.rotation = Quaternion.fromEulerDegrees(0, (crownHeading * 180) / Math.PI, 0)
}

function updateHat(headPosition: Vector3) {
  const t = Transform.getMutable(hatRoot)
  if (equippedHat < 0 || phase !== 'running' || playerLeadsMatch()) { t.position.y = -2; return }
  const config = snakeHats[equippedHat]
  const scale = config.scale * (isMobile() ? MOBILE_HEADWEAR_SCALE : 1)
  Transform.getMutable(hatModel).scale = Vector3.create(scale, scale, scale)
  t.position = Vector3.create(headPosition.x, 0.52, headPosition.z)
  t.rotation = Quaternion.fromEulerDegrees(0, (heading * 180) / Math.PI, 0)
}

function spawnChest() {
  Transform.getMutable(chest).position = randomArenaPosition(0.35)
  chestActive = true
  chestSpawnTimer = 180 + Math.random() * 180
  Animator.stopAllAnimations(chest)
  const closed = Animator.getClip(chest, 'open_chest')
  closed.playing = true
  closed.loop = false
  closed.speed = 0
}

function updateChest(dt: number, headPosition: Vector3) {
  if (chestSequence === 'idle') {
    if (!chestActive) { chestSpawnTimer -= dt; if (chestSpawnTimer <= 0) spawnChest() }
    if (chestActive && Vector3.distanceSquared(Transform.get(chest).position, headPosition) < 0.5) {
      chestActive = false
      chestSequence = 'opening'
      chestSequenceTimer = 0
      Transform.getMutable(chest).position = Vector3.create(headPosition.x, 1.0, headPosition.z)
      const opening = Animator.getClip(chest, 'open_chest')
      opening.speed = 1
      Animator.playSingleAnimation(chest, 'open_chest', true)
    }
    return
  }
  chestSequenceTimer += dt
  const chestTransform = Transform.getMutable(chest)
  chestTransform.position = Vector3.create(headPosition.x, 1.0, headPosition.z)
  chestTransform.rotation = Quaternion.fromLookAt(chestTransform.position, Transform.get(camera).position)
  if (chestSequence === 'opening' && chestSequenceTimer > 1.15) {
    const locked = ownedHats.map((owned, i) => owned ? -1 : i).filter((i) => i >= 0)
    pendingHat = locked.length ? locked[Math.floor(Math.random() * locked.length)] : Math.floor(Math.random() * snakeHats.length)
    const config = snakeHats[pendingHat]
    GltfContainer.getMutable(rewardHatModel).src = config.src
    const rewardModelTransform = Transform.getMutable(rewardHatModel)
    rewardModelTransform.position = config.offset
    const scale = config.scale * REWARD_HAT_SCALE
    rewardModelTransform.scale = Vector3.create(scale, scale, scale)
    Transform.getMutable(rewardHatRoot).position = Vector3.create(headPosition.x, 1.12, headPosition.z)
    chestSequence = 'hatReveal'; chestSequenceTimer = 0
  } else if (chestSequence === 'hatReveal') {
    const rewardTransform = Transform.getMutable(rewardHatRoot)
    rewardTransform.position = Vector3.create(headPosition.x, 1.48 + Math.sin(chestSequenceTimer * 4) * 0.08, headPosition.z)
    rewardTransform.rotation = Quaternion.fromEulerDegrees(0, chestSequenceTimer * 260, 0)
    if (chestSequenceTimer > 2.15) {
      ownedHats[pendingHat] = true
      newlyUnlockedHat = -1
      chestSequence = 'idle'; chestSequenceTimer = 0
      chestTransform.position.y = -2
      rewardTransform.position.y = -2
      pendingHat = -1
    }
  }
}

function checkSkinUnlocks() {
  for (let i = 0; i < snakeSkins.length; i++) {
    if (snakeSkins[i].special && isSkinUnlocked(i) && !announcedUnlocks.has(i)) {
      announcedUnlocks.add(i)
      newlyUnlockedSkin = i
      console.log(`[UNLOCK] skin=${snakeSkins[i].name} energy=${energyCollected}`)
      break
    }
  }
}

export function toggleMenu() {
  ensureThemePlaying()
  if (phase !== 'running') menuOpen = !menuOpen
}

function updateTrail(headPosition: Vector3) {
  positionTrail.unshift(Vector3.clone(headPosition))
  // Six samples per visible block is enough for smooth interpolation and keeps
  // unshift/scan cost bounded even when the logical score grows indefinitely.
  const maxTrail = (Math.min(visibleSegmentCount(), MAX_LOGICAL_TRAIL_SEGMENTS) + 4) * 6
  if (positionTrail.length > maxTrail) positionTrail.length = maxTrail

  const shown = Math.min(visibleSegmentCount(), segments.length)
  renderedSegmentCount = shown
  const renderedLogicalSegments = Math.min(visibleSegmentCount(), MAX_LOGICAL_TRAIL_SEGMENTS)
  const renderSpacing = shown > 0 ? (renderedLogicalSegments * SEGMENT_SPACING) / shown : SEGMENT_SPACING
  const stretch = Math.max(1, renderSpacing / SEGMENT_SPACING)
  let trailIndex = 1
  let walked = 0
  for (let i = 0; i < segments.length; i++) {
    const transform = Transform.getMutable(segments[i])
    if (i >= shown) {
      transform.position.y = -2
      continue
    }
    const targetDistance = (i + 1) * renderSpacing
    while (trailIndex < positionTrail.length) {
      const from = positionTrail[trailIndex - 1]
      const to = positionTrail[trailIndex]
      const step = Vector3.distance(from, to)
      if (walked + step >= targetDistance && step > 0) {
        const amount = (targetDistance - walked) / step
        transform.position = Vector3.create(
          from.x + (to.x - from.x) * amount,
          from.y + (to.y - from.y) * amount,
          from.z + (to.z - from.z) * amount
        )
        const yaw = Math.atan2(to.x - from.x, to.z - from.z) * 180 / Math.PI
        transform.rotation = Quaternion.multiply(Quaternion.fromEulerDegrees(0, yaw, 0), DIAMOND_TILT)
        const taper = bodyTaper(i, shown)
        transform.scale = Vector3.create(
          BODY_BLOCK_SIZE * taper,
          BODY_BLOCK_SIZE * taper,
          BODY_BLOCK_SIZE * stretch * BODY_BLOCK_OVERLAP * Math.max(0.9, taper)
        )
        break
      }
      walked += step
      trailIndex += 1
    }
    if (trailIndex >= positionTrail.length) transform.position = Vector3.clone(positionTrail[positionTrail.length - 1])
  }
}

function stampSandTrail(headPosition: Vector3, dt: number) {
  sandStampTimer += dt
  if (sandStampTimer < SAND_STAMP_INTERVAL) return
  sandStampTimer = 0
  const stamp = sandTracks[nextSandStamp]
  nextSandStamp = (nextSandStamp + 1) % sandTracks.length
  stamp.active = true
  stamp.age = 0
  const t = Transform.getMutable(stamp.entity)
  t.position = Vector3.create(headPosition.x, 0.118, headPosition.z)
  t.rotation = Quaternion.fromEulerDegrees(90, (heading * 180) / Math.PI, 0)
}

function updateSandTrailLifetime(dt: number) {
  for (const stamp of sandTracks) {
    if (!stamp.active) continue
    stamp.age += dt
    if (stamp.age > SAND_STAMP_LIFESPAN) {
      stamp.active = false
      Transform.getMutable(stamp.entity).position.y = -2
    }
  }
}

function pointAlongTrail(targetDistance: number): Vector3 {
  let walked = 0
  for (let i = 1; i < positionTrail.length; i++) {
    const from = positionTrail[i - 1]
    const to = positionTrail[i]
    const step = Vector3.distance(from, to)
    if (walked + step >= targetDistance && step > 0) {
      const t = (targetDistance - walked) / step
      return Vector3.create(
        from.x + (to.x - from.x) * t,
        from.y + (to.y - from.y) * t,
        from.z + (to.z - from.z) * t
      )
    }
    walked += step
  }
  return Vector3.clone(positionTrail[positionTrail.length - 1])
}

function expireDeathDrops() {
  const now = Date.now()
  for (const [entity, state, transform] of engine.getEntitiesWith(DeathDropState, Transform)) {
    // Synced drops are durable evidence of death even if its MessageBus event
    // was lost or arrived later. A newer run is never killed by an older drop.
    const origin = DeathDropOrigin.getOrNull(entity)
    if (origin && state.ownerId !== networkPlayerId && lifecycle.accept(state.ownerId, origin, true)) {
      const victim = remoteSnakes.get(state.ownerId)
      if (victim) {
        victim.phase = 'gameover'
        victim.targetPoints = []
        hideRemoteSnake(victim)
      }
    }
    const expired = state.expiresAt > 0 && now >= state.expiresAt
    if (expired && state.active) DeathDropState.getMutable(entity).active = false
    const visible = state.active && !expired
    if (VisibilityComponent.getOrNull(entity)?.visible !== visible) {
      VisibilityComponent.createOrReplace(entity, { visible })
    }
    if (!visible && transform.position.y >= 0) Transform.getMutable(entity).position.y = -2
  }
  for (const drop of deathDrops) drop.active = DeathDropState.getOrNull(drop.entity)?.active === true
}

function collectFood(headPosition: Vector3) {
  for (const food of foods) {
    const transform = Transform.getMutable(food)
    if (Vector3.distanceSquared(transform.position, headPosition) < 0.18) {
      runEnergy += 1
      energyCollected += 1
      ensureSegmentCapacity(START_SEGMENTS + runEnergy)
      playEatSound()
      transform.position = randomOpenFoodPosition(food)
      console.log(`[H1-01] energy total=${energyCollected} run-energy=${runEnergy}`)
    }
  }

  // Runtime death drops are synced entities. Whichever snake reaches one
  // first marks the shared component inactive, hiding that same orb for all.
  for (const [entity, dropState, transform] of engine.getEntitiesWith(DeathDropState, Transform)) {
    if (!dropState.active) continue
    if (Vector3.distanceSquared(transform.position, headPosition) < 0.23) {
      DeathDropState.getMutable(entity).active = false
      VisibilityComponent.createOrReplace(entity, { visible: false })
      Transform.getMutable(entity).position.y = -2
      runEnergy += 1
      energyCollected += 1
      ensureSegmentCapacity(START_SEGMENTS + runEnergy)
      playEatSound()
      console.log(`[H1-01] collected fallen energy total=${energyCollected} run-energy=${runEnergy}`)
    }
  }

  // Food is server-owned in the authoritative build. Claiming it sends only
  // an id/revision and the current head position; the server checks both.
  if (phase !== 'running' || !isStateSyncronized()) return
  const claims: Array<{ id: string; revision: number }> = []
  for (const [entity, food] of engine.getEntitiesWith(SharedFood)) {
    if (food.epoch !== serverEpoch || !food.active) continue
    const pending = pendingFoodClaims.get(food.id)
    if (pending?.revision === food.revision && Date.now() - pending.sentAt < 150) continue
    const dx = food.position.x - headPosition.x, dz = food.position.z - headPosition.z
    if (dx * dx + dz * dz < FOOD_PICKUP_RADIUS_SQUARED) {
      pendingFoodClaims.set(food.id, { revision: food.revision, sentAt: Date.now() })
      // Hide this client's visual in the pickup frame; shared state and growth
      // still come from the server. This avoids food trailing inside the body.
      const visual = serverFoodVisuals.get(food.id)
      if (visual) Transform.getMutable(visual.entity).position.y = -2
      claims.push({ id: food.id, revision: food.revision })
      if (claims.length >= 8) break
    }
  }
  if (claims.length) {
    void room.send('collectFood', {
      playerId: networkPlayerId, run: runsStarted,
      x: headPosition.x, z: headPosition.z, items: claims
    })
  }
}

function updateServerFoodVisuals() {
  // The server's cumulative per-run earnings identify the collector and survive
  // reordered/coalesced updates. A food revision alone cannot prove who ate it.
  for (const [, player] of engine.getEntitiesWith(MatchPlayer)) {
    if (player.playerId !== networkPlayerId || player.run !== runsStarted || player.epoch !== serverConnection().epoch) continue
    matchKills = player.kills ?? 0
    if (player.earned > runEnergy) {
      energyCollected += player.earned - runEnergy
      runEnergy = player.earned
      ensureSegmentCapacity(START_SEGMENTS + runEnergy)
      playEatSound()
    }
  }
  const seen = new Set<string>()
  for (const [entity, food] of engine.getEntitiesWith(SharedFood)) {
    if (food.epoch > serverEpoch) serverEpoch = food.epoch
    if (food.epoch !== serverEpoch) continue
    seen.add(food.id)
    let visual = serverFoodVisuals.get(food.id)
    if (!visual) {
      visual = {
        entity: createDiamondBlock(food.position, Vector3.create(food.size, food.size, food.size), food.color),
        revision: food.revision, active: food.active, x: food.position.x, z: food.position.z
      }
      serverFoodVisuals.set(food.id, visual)
    }
    const previousRevision = visual.revision
    const claimedRevision = pendingFoodClaims.get(food.id)?.revision
    if (claimedRevision !== undefined && food.revision > claimedRevision) {
      pendingFoodClaims.delete(food.id)
    }
    const pending = pendingFoodClaims.get(food.id)
    const predictedPickup = pending?.revision === food.revision && Date.now() - pending.sentAt < 2500
    // An unconfirmed claim must not hide uneaten food forever after packet loss.
    if (pending && !predictedPickup) pendingFoodClaims.delete(food.id)
    visual.revision = food.revision
    visual.active = food.active
    visual.x = food.position.x
    visual.z = food.position.z
    const t = Transform.getMutable(visual.entity)
    t.position = food.active && !predictedPickup ? Vector3.clone(food.position) : Vector3.create(food.position.x, -2, food.position.z)
    t.scale = Vector3.create(food.size, food.size, food.size)
    if (previousRevision !== food.revision) {
      Material.setPbrMaterial(visual.entity, { albedoColor: food.color, roughness: 0.38, metallic: 0.03 })
    }
  }
  for (const [id, visual] of serverFoodVisuals) {
    if (seen.has(id)) continue
    Transform.getMutable(visual.entity).position.y = -2
  }
}

function explodeIntoEnergy(position: Vector3, deathSequence: number) {
  const count = Math.min(DEATH_DROP_COUNT, Math.max(10, visibleSegmentCount() + 4))
  const skin = snakeSkins[selectedSkin]
  const trailLength = Math.max(0.2, (visibleSegmentCount() - 1) * SEGMENT_SPACING)
  for (let i = 0; i < count; i++) {
    const alongTrail = ((i + Math.random()) / count) * trailLength
    const trailPoint = positionTrail.length > 1 ? pointAlongTrail(alongTrail) : position
    const angle = Math.random() * Math.PI * 2
    const scatter = 0.18 + Math.random() * 0.45
    const dropPosition = Vector3.create(
      Math.max(ARENA_MIN + 0.5, Math.min(ARENA_MAX - 0.5, trailPoint.x + Math.cos(angle) * scatter)),
      FOOD_Y,
      Math.max(ARENA_MIN + 0.5, Math.min(ARENA_MAX - 0.5, trailPoint.z + Math.sin(angle) * scatter))
    )
    const color = i === 0 ? skin.head : i % 2 === 0 ? skin.bodyA : skin.bodyB
    const size = 0.13 + Math.random() * 0.1
    const origin = { session: networkSession, run: runsStarted, sequence: deathSequence }
    const dropId = `${networkPlayerId || 'guest'}:${runsStarted}:${networkSequence}:${i}`
    const reusableIndex = deathDrops.findIndex((drop) => !drop.active)
    const recycled = reusableIndex >= 0 ? deathDrops.splice(reusableIndex, 1)[0] : undefined
    if (recycled) {
      const t = Transform.getMutable(recycled.entity)
      t.position = dropPosition
      t.scale = Vector3.create(size, size, size)
      t.rotation = DIAMOND_TILT
      Material.setPbrMaterial(recycled.entity, {
        albedoColor: color,
        emissiveColor: Color3.create(color.r * 0.12, color.g * 0.12, color.b * 0.12),
        emissiveIntensity: 0.32,
        roughness: 0.38,
        metallic: 0.03
      })
      const shared = DeathDropState.getMutable(recycled.entity)
      shared.active = true
      shared.ownerId = networkPlayerId || 'guest'
      shared.dropId = dropId
      shared.expiresAt = Date.now() + DEATH_DROP_LIFESPAN_MS
      DeathDropOrigin.createOrReplace(recycled.entity, origin)
      VisibilityComponent.createOrReplace(recycled.entity, { visible: true })
      recycled.active = true
      deathDrops.push(recycled)
    } else if (deathDrops.length < MAX_LOCAL_DEATH_DROPS) {
      const entity = createDiamondBlock(dropPosition, Vector3.create(size, size, size), color)
      DeathDropState.create(entity, {
        active: true,
        ownerId: networkPlayerId || 'guest',
        dropId,
        expiresAt: Date.now() + DEATH_DROP_LIFESPAN_MS
      })
      DeathDropOrigin.create(entity, origin)
      try {
        syncEntity(entity, [Transform.componentId, MeshRenderer.componentId, Material.componentId, DeathDropState.componentId, DeathDropOrigin.componentId])
      } catch (error) {
        // Offline/local preview can briefly lack a network profile. Keep the
        // drop playable locally instead of allowing networking to break death.
        console.error('[Snake Cluster] Could not synchronize death energy', error)
      }
      deathDrops.push({ entity, active: true })
    }
  }
}

function checkCollision(headPosition: Vector3, previousHead = headPosition): { reason: string, killerId: string } | null {
  if (
    headPosition.x <= ARENA_MIN ||
    headPosition.x >= ARENA_MAX ||
    headPosition.z <= ARENA_MIN ||
    headPosition.z >= ARENA_MAX
  ) return { reason: 'Arena collision', killerId: '' }

  const headTip = Vector3.create(
    headPosition.x + Math.sin(heading) * 0.26,
    headPosition.y,
    headPosition.z + Math.cos(heading) * 0.26
  )

  const shown = renderedSegmentCount
  for (let i = 11; i < shown; i++) {
    const from = Transform.get(segments[i - 1]).position
    const to = Transform.get(segments[i]).position
    if (touchesBody(headTip, from, to, BODY_COLLISION_RADIUS_SQUARED)) {
      return { reason: 'Self collision', killerId: '' }
    }
  }

  // A short spawn shield prevents overlapping join positions from producing
  // unfair instant deaths. After it expires, only the nose tip is tested
  // against remote body lines; food/death drops never participate here.
  if (currentRunElapsed >= SPAWN_GRACE_SECONDS) {
    for (const remote of remoteSnakes.values()) {
      if (remote.phase !== 'running' || uiElapsed - remote.lastSeen > REMOTE_STALE_SECONDS) continue
      // Collision follows the interpolated body actually shown on this client.
      // Network target coordinates can be visibly ahead of the rendered snake.
      for (let i = 0; i < remote.segments.length; i++) {
        const from = i === 0 ? Transform.get(remote.head).position : Transform.get(remote.segments[i - 1]).position
        const to = Transform.get(remote.segments[i]).position
        if (from.y >= 0 && to.y >= 0 && headCrossesBody(previousHead, headPosition, from, to)) {
          return { reason: `Blocked by ${remote.name}`, killerId: remote.playerId }
        }
      }
    }
  }
  return null
}

export function snakeGameSystem(dt: number) {
  if (!Number.isFinite(dt) || dt <= 0) return
  uiElapsed += dt
  refreshPlayerProfile()
  updateAudio(dt)
  networkSendTimer = Math.max(0, networkSendTimer - dt)
  expireDeathDrops()
  receiveServerSnakes()
  if (isStateSyncronized() && Date.now() - lastPing > 2000) {
    lastPing = Date.now(); void room.send('ping', { sentAt: lastPing })
  }
  presentationClock.advance(Date.now(), dt)
  updateRemoteSnakes(dt)
  // Remains must render and expire while spectating or in the death menu too.
  updateServerFoodVisuals()
  updateCrown(Transform.get(head).position)
  if (testStarted && testElapsed < TEST_SECONDS) testElapsed = Math.min(TEST_SECONDS, testElapsed + dt)
  updateSandTrailLifetime(dt)

  if (phase !== 'running') {
    broadcastSnakeState()
    Transform.getMutable(hatRoot).position.y = -2
    Transform.getMutable(rewardHatRoot).position.y = -2
    if (phase === 'exited') {
      if (!Transform.has(engine.PlayerEntity)) return
      const playerPosition = Transform.get(engine.PlayerEntity).position
      const insideArena =
        playerPosition.x > ARENA_MIN && playerPosition.x < ARENA_MAX &&
        playerPosition.z > ARENA_MIN && playerPosition.z < ARENA_MAX

      // Arm re-entry only after the leave teleport has actually placed the
      // avatar outside. Crossing back through the fence then restores the
      // initial skin menu and hides the avatar before a new snake is started.
      if (!insideArena) exitedArenaOnce = true
      else if (exitedArenaOnce) returnToGameMenu()
      return
    }
    // Menus are an explicit UI state. Do not let a stale pointer/touch event
    // (or the tap used to focus Explorer) skip the skin picker on re-entry.
    // A run starts only from the PLAY / PLAY AGAIN UI action.
    return
  }

  // Returning from an app suspension must not advance several seconds of
  // movement in one frame and teleport the head through the arena wall.
  dt = Math.min(dt, 0.05)
  currentRunElapsed += dt

  const transform = Transform.getMutable(head)
  const previousHead = Vector3.clone(transform.position)
  const pointer = PrimaryPointerInfo.getOrNull(engine.RootEntity)
  const mobile = isMobile()
  const keyboardTurn = (inputSystem.isPressed(InputAction.IA_LEFT) ? -1 : 0) + (inputSystem.isPressed(InputAction.IA_RIGHT) ? 1 : 0)
  // Capture device intent. Acceleration, turning and movement execute on the server.
  // Steering only reads pointer travel while the left button is held, so a
  // deliberate drag controls the snake instead of incidental mouse movement.
  const mouseTurn = !mobile && inputSystem.isPressed(InputAction.IA_POINTER)
    ? mouseTurnRate(pointer?.screenDelta?.x ?? 0, dt)
    : 0
  if (currentTurn !== keyboardTurn) networkSendTimer = 0
  currentTurn = keyboardTurn
  pointerTurnIntegral += mouseTurn * dt; pointerSampleSeconds += dt

  // SDK7 exposes its portable secondary action (F), but not a distinct
  // right-mouse input. Keep boost on that reliable action for every client.
  const mouseBoost = !mobile && inputSystem.isPressed(InputAction.IA_SECONDARY)
  const actionBoost = inputSystem.isPressed(InputAction.IA_PRIMARY) ||
    (!mobile && (inputSystem.isPressed(InputAction.IA_FORWARD) || inputSystem.isPressed(InputAction.IA_MODIFIER)))
  if (requestedBoost !== (mouseBoost || actionBoost)) networkSendTimer = 0
  requestedBoost = mouseBoost || actionBoost
  // Send controls only. The server alone integrates heading, speed and boost cost.
  renderOwnSnake(dt)
  if (boostingActive) boostUsed = true
  transform.rotation = Quaternion.fromEulerDegrees(0, (heading * 180) / Math.PI, 0)

  const cameraTransform = Transform.getMutable(camera)
  const rig = cameraRig.update(cameraTransform.position, transform.position, heading, dt)
  cameraTransform.position = Vector3.create(rig.position.x, rig.position.y, rig.position.z)
  cameraTransform.rotation = Quaternion.fromLookAt(cameraTransform.position, Vector3.create(rig.target.x, rig.target.y, rig.target.z))

  updateFace(transform.position)
  updateCrown(transform.position)
  updateHat(transform.position)
  updateTrail(transform.position)
  stampSandTrail(transform.position, dt)
  collectFood(transform.position)
  checkSkinUnlocks()
  updateChest(dt, transform.position)
  updatePlayerTag(transform.position)
  // Only authoritative snapshots end a run; no client-side rival/wall verdicts.
  broadcastSnakeState()

  if (currentRunElapsed >= CONTROL_PASS_SECONDS && boostUsed) {
    const platform = getPlatform()
    if (platform === 'mobile') mobilePassed = true
    else desktopPassed = true
  }
}

export function getExperimentView() {
  return {
    networkRttMs: networkClock.rttMs,
    phase,
    runsStarted,
    energyCollected,
    runEnergy,
    length: visibleSegmentCount(),
    testElapsed,
    testSeconds: TEST_SECONDS,
    resultMessage,
    passed: runsStarted >= 3,
    selectedSkin,
    skinName: snakeSkins[selectedSkin].name,
    skinColor: snakeSkins[selectedSkin].head,
    menuOpen,
    boostingPossible: visibleSegmentCount() > 5,
    boostUsed,
    boostingActive,
    currentRunElapsed,
    desktopPassed,
    mobilePassed,
    newlyUnlockedSkin,
    newlyUnlockedHat,
    equippedHat,
    chestActive,
    chestSequence,
    platform: getPlatform() ?? 'detecting',
    uiElapsed
    ,musicEnabled
    ,soundEnabled
    ,menuSession
  }
}

// Runs the production game logic against isolated ECS stores and reordered
// peer packets. No Explorer, wallet, or external network is needed.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const esbuild = require('esbuild')
const root = path.resolve(__dirname, '..')
const mathCode = esbuild.buildSync({ entryPoints: [require.resolve('@dcl/sdk/math')], bundle: true, write: false, platform: 'node', format: 'cjs' }).outputFiles[0].text
const mathModule = { exports: {} }
vm.runInNewContext(mathCode, { module: mathModule, exports: mathModule.exports, require })
const fixture = `
import { ServerStatus } from './multiplayer-state'
export const testApi = {
  applyServerPacket, ownTrack, presentationClock, renderOwnSnake,
  headPosition: () => Transform.get(head).position,
  receiveSnakeState, receiveSnakeDeath, collectFood, checkCollision, expireDeathDrops, updateRemoteSnakes,
  explodeIntoEnergy, remoteSnakes, DeathDropState, DeathDropOrigin,
  updateServerFoodVisuals, SharedFood, MatchPlayer, ServerStatus, serverFoodVisuals, SnakeSnapshot, receiveServerSnakes, crownLeader,
  stats: () => ({ runEnergy, matchKills, renderedSegmentCount, phase, session: networkSession, run: runsStarted }),
  prepareDeath: () => {
    for (const assign of [(e: Entity) => playerTagRoot = e, (e: Entity) => playerNameLabel = e,
      (e: Entity) => crownRoot = e, (e: Entity) => hatRoot = e]) {
      assign(createSphere(Vector3.create(16, -2, 16), Vector3.One(), Color4.White()))
    }
  },
  advance: (dt: number) => { uiElapsed += dt },
  seed: () => {
    networkPlayerId = 'local'; soundEnabled = false; phase = 'running';
    currentRunElapsed = 10; heading = 0; runEnergy = 2;
    head = createSphere(Vector3.create(23, .32, 10.24), Vector3.One(), Color4.White());
    for (let i = 0; i < 32; i++) segments.push(createDiamondBlock(
      i < 11 ? Vector3.create(30, .32, 5) : Vector3.create(16, -2, 16), Vector3.One(), Color4.White()));
    renderedSegmentCount = 11;
  },
  visibleSelfHit: () => {
    renderedSegmentCount = 12;
    Transform.getMutable(segments[11]).position = Vector3.create(23, .32, 10.5);
  }
}
`
const gameCode = esbuild.buildSync({ stdin: { contents: fs.readFileSync(path.join(root, 'src/snake-game.ts'), 'utf8') + fixture, resolveDir: path.join(root, 'src'), loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'cjs', external: ['@dcl/*', '~system/*'] }).outputFiles[0].text

function client() {
  let nextId = 100, nextComponent = 1, now = 1000000
  const sent = []
  const components = []
  const component = () => {
    const data = new Map()
    const c = {
      data, componentId: nextComponent++,
      create: (id, value) => data.set(id, structuredClone(value)),
      createOrReplace: (id, value) => data.set(id, structuredClone(value)),
      get: id => { assert.ok(data.has(id), `Missing component on ${id}`); return data.get(id) },
      getMutable: id => c.get(id), getOrNull: id => data.get(id),
      has: id => data.has(id), deleteFrom: id => data.delete(id),
      setBox: id => data.set(id, {}), setSphere: id => data.set(id, {}),
      setPbrMaterial: (id, value) => data.set(id, value), playSound: () => {}
    }
    components.push(c)
    return c
  }
  const engine = {
    RootEntity: 0, CameraEntity: 1, PlayerEntity: 2,
    addEntity: () => nextId++,
    defineComponent: () => component(),
    removeEntity: id => components.forEach(c => c.data.delete(id)),
    *getEntitiesWith(...cs) {
      for (const [id] of cs[0].data) if (cs.every(c => c.has(id))) yield [id, ...cs.map(c => c.get(id))]
    }
  }
  const schemas = new Proxy({}, { get: (_target, key) => key === 'Map' || key === 'Array' ? () => ({}) : {} })
  const ecs = new Proxy({ engine, Schemas: schemas, inputSystem: { isPressed: () => false } }, {
    get(target, key) { return target[key] ?? (target[key] = component()) }
  })
  const module = { exports: {} }
  vm.runInNewContext(gameCode, {
    module, exports: module.exports, console: { log() {}, error: console.error },
    Date: class extends Date { static now() { return now } },
    require: name => {
      if (name === '@dcl/sdk/ecs') return ecs
      if (name === '@dcl/sdk/math') return mathModule.exports
      if (name === '@dcl/sdk/message-bus') return { MessageBus: class { on() {} emit() {} } }
      if (name === '@dcl/sdk/platform') return { isMobile: () => false, getPlatform: () => 'desktop' }
      if (name === '@dcl/sdk/network') return { syncEntity() {}, registerMessages: () => ({ send: (type, data) => sent.push({ type, data }), onMessage() {} }), isStateSyncronized: () => true }
      return {}
    }
  })
  const api = module.exports.testApi
  api.seed()
  function drop(owner = 'other', origin = { session: 1, run: 1, sequence: 20 }, position = { x: 23, y: .28, z: 10.24 }) {
    const entity = engine.addEntity()
    ecs.Transform.create(entity, { position, scale: { x: .2, y: .2, z: .2 } })
    api.DeathDropState.create(entity, { active: true, ownerId: owner, dropId: `drop-${entity}`, expiresAt: now + 45000 })
    api.DeathDropOrigin.create(entity, origin)
    return entity
  }
  return { ...api, drop, ecs, engine, sent, tick: ms => { now += ms; api.advance(ms / 1000) } }
}
const head = { x: 23, y: .32, z: 10.24 }
const packet = (overrides = {}) => ({ session: 1, run: 1, sequence: 10, playerId: 'other', name: 'Rival', phase: 'running', heading: 0, length: 12, score: 12, skin: 0, hat: -1, boosting: false, points: [{ x: 23, z: 10.5 }, { x: 24, z: 10.5 }], ...overrides })
let passed = 0
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`) }

function sharedFood(c) {
  c.ServerStatus.create(c.engine.addEntity(), { epoch: 1, heartbeat: 1 })
  const entity = c.engine.addEntity()
  c.SharedFood.create(entity, { epoch: 1, id: 'shared', revision: 1, active: true, dropped: false,
    position: { x: head.x + .53, y: .28, z: head.z }, size: .2, color: { r: 1, g: 1, b: 1, a: 1 } })
  c.updateServerFoodVisuals()
  return entity
}
test('unanswered server food claims retry while the head overlaps', () => {
  const c = client(); sharedFood(c)
  c.collectFood(head)
  assert.equal(c.sent.length, 1)
  c.collectFood(head); assert.equal(c.sent.length, 1)
  c.tick(160); c.collectFood(head)
  assert.equal(c.sent.length, 2)
})
test('food hides immediately, stays hidden during latency, and shows its confirmed respawn', () => {
  const c = client(); const food = sharedFood(c)
  const visual = c.serverFoodVisuals.get('shared').entity
  c.collectFood(head)
  assert.equal(c.ecs.Transform.get(visual).position.y, -2)
  c.tick(500); c.updateServerFoodVisuals()
  assert.equal(c.ecs.Transform.get(visual).position.y, -2)
  assert.equal(c.stats().runEnergy, 2)
  c.SharedFood.getMutable(food).revision++
  c.SharedFood.getMutable(food).position.x = 5
  c.updateServerFoodVisuals()
  assert.equal(c.ecs.Transform.get(visual).position.x, 5)
  assert.equal(c.ecs.Transform.get(visual).position.y, .28)
})
test('unconfirmed food returns after timeout; confirmed death food stays hidden', () => {
  const c = client(); const food = sharedFood(c)
  const visual = c.serverFoodVisuals.get('shared').entity
  c.collectFood(head); c.tick(2600); c.updateServerFoodVisuals()
  assert.equal(c.ecs.Transform.get(visual).position.y, .28)
  c.collectFood(head)
  c.SharedFood.getMutable(food).active = false
  c.SharedFood.getMutable(food).revision++
  c.tick(2600); c.updateServerFoodVisuals()
  assert.equal(c.ecs.Transform.get(visual).position.y, -2)
})
test('server earnings grow the snake for normal and death food exactly once', () => {
  const c = client(); const food = sharedFood(c)
  const player = c.engine.addEntity()
  c.MatchPlayer.create(player, { epoch: 1, playerId: 'local', run: 0, earned: 3 })
  c.updateServerFoodVisuals(); assert.equal(c.stats().runEnergy, 3)
  c.SharedFood.getMutable(food).active = false
  c.SharedFood.getMutable(food).revision++
  c.MatchPlayer.getMutable(player).earned = 4
  c.updateServerFoodVisuals(); assert.equal(c.stats().runEnergy, 4)
  c.updateServerFoodVisuals(); assert.equal(c.stats().runEnergy, 4)
})
test('a rival eating claimed food does not award local growth', () => {
  const c = client(); const food = sharedFood(c); c.collectFood(head)
  c.SharedFood.getMutable(food).revision++
  c.updateServerFoodVisuals(); assert.equal(c.stats().runEnergy, 2)
})
test('two isolated clients render retained server snakes without peer messages', () => {
  for (const c of [client(), client()]) {
    c.ServerStatus.create(c.engine.addEntity(), { epoch: 1, heartbeat: 1 })
    const entity = c.engine.addEntity()
    c.SnakeSnapshot.create(entity, { epoch: 1, payload: JSON.stringify(packet()) })
    c.receiveServerSnakes(); c.updateRemoteSnakes(.1)
    const remote = c.remoteSnakes.get('other')
    assert.ok(remote)
    assert.ok(c.ecs.Transform.get(remote.head).position.y > 0)
    assert.ok(c.checkCollision(head), 'rendered opponent body blocks the local head')
    c.SnakeSnapshot.createOrReplace(entity, { epoch: 1, payload: JSON.stringify(packet({ phase: 'gameover', points: [], sequence: 11 })) })
    c.receiveServerSnakes(); c.updateRemoteSnakes(.1)
    assert.equal(c.ecs.Transform.get(remote.head).position.y, -2)
    assert.equal(c.checkCollision(head), null)
    c.SnakeSnapshot.createOrReplace(entity, { epoch: 1, payload: JSON.stringify(packet({ run: 2, sequence: 12 })) })
    c.receiveServerSnakes(); c.updateRemoteSnakes(.1)
    assert.ok(c.ecs.Transform.get(remote.head).position.y > 0)
    c.engine.removeEntity(entity); c.receiveServerSnakes()
    assert.equal(c.remoteSnakes.size, 0)
  }
})

test('eating death food grows before rendering without hitting an offscreen pool block', () => {
  const c = client(); c.drop()
  assert.equal(c.checkCollision(head), null)
  c.collectFood(head)
  assert.equal(c.stats().runEnergy, 3)
  assert.equal(c.stats().renderedSegmentCount, 11)
  assert.equal(c.checkCollision(head), null)
})
test('mass food pickup cannot add hidden blocks to collision tests', () => {
  const c = client(); for (let i = 0; i < 40; i++) c.drop()
  c.collectFood(head)
  assert.equal(c.stats().runEnergy, 42)
  assert.equal(c.checkCollision(head), null)
})
test('real visible body contact still kills instantly', () => {
  const c = client(); c.visibleSelfHit()
  assert.equal(c.checkCollision(head).reason, 'Self collision')
})
test('death drops remove a ghost body when the death message is missing', () => {
  const c = client(); c.receiveSnakeState(packet(), 'peer'); c.updateRemoteSnakes(.1)
  assert.ok(c.checkCollision(head))
  c.drop(); c.expireDeathDrops()
  assert.equal(c.checkCollision(head), null)
  c.receiveSnakeState(packet({ sequence: 15 }), 'peer')
  assert.equal(c.remoteSnakes.get('other').phase, 'gameover')
})
test('old movement cannot revive a dead snake after a long delay', () => {
  const c = client(); c.drop(); c.expireDeathDrops(); c.tick(30000)
  c.receiveSnakeState(packet({ sequence: 21 }), 'peer')
  assert.equal(c.remoteSnakes.size, 0)
})
test('new run can spawn; old food and delayed death cannot kill that run', () => {
  const c = client(); c.drop(); c.expireDeathDrops()
  c.receiveSnakeState(packet({ run: 2, sequence: 30 }), 'peer')
  c.receiveSnakeDeath({ session: 1, run: 1, sequence: 20, victimId: 'other', killerId: '' }, 'peer')
  c.expireDeathDrops()
  assert.equal(c.remoteSnakes.get('other').phase, 'running')
})
test('duplicate death packets award only one kill', () => {
  const c = client(), death = { session: 1, run: 1, sequence: 20, victimId: 'other', killerId: 'local' }
  c.receiveSnakeDeath(death, 'peer'); c.receiveSnakeDeath(death, 'peer')
  assert.equal(c.stats().matchKills, 1)
})
test('food proof arriving before death event still awards one kill', () => {
  const c = client(); c.drop(); c.expireDeathDrops()
  c.receiveSnakeDeath({ session: 1, run: 1, sequence: 20, victimId: 'other', killerId: 'local' }, 'peer')
  assert.equal(c.stats().matchKills, 1)
})
test('dropped food expires exactly at 45 seconds, including in menus', () => {
  const c = client(), id = c.drop(); c.tick(44999); c.expireDeathDrops()
  assert.equal(c.DeathDropState.get(id).active, true)
  c.tick(1); c.expireDeathDrops()
  assert.equal(c.DeathDropState.get(id).active, false)
  assert.equal(c.ecs.VisibilityComponent.get(id).visible, false)
})
test('late transform updates cannot reveal consumed food', () => {
  const c = client(), id = c.drop(); c.collectFood(head)
  c.ecs.Transform.getMutable(id).position = { ...head }
  c.expireDeathDrops()
  assert.equal(c.ecs.VisibilityComponent.get(id).visible, false)
  assert.equal(c.ecs.Transform.get(id).position.y, -2)
  c.collectFood(head); assert.equal(c.stats().runEnergy, 3)
})
test('invalid trail points do not turn into invisible collision chords', () => {
  const c = client(); c.receiveSnakeState(packet({ points: [{ x: 3, z: 3 }, null, { x: 30, z: 30 }] }), 'peer')
  assert.equal(c.remoteSnakes.get('other').targetPoints.length, 0)
  assert.equal(c.checkCollision(head), null)
})
test('visible opponents remain solid through network jitter, then hide and stop killing together', () => {
  const c = client(); c.receiveSnakeState(packet(), 'peer'); c.updateRemoteSnakes(.1); c.tick(600)
  assert.ok(c.checkCollision(head))
  c.tick(2500); c.updateRemoteSnakes(.1)
  assert.equal(c.ecs.Transform.get(c.remoteSnakes.get('other').head).position.y, -2)
  assert.equal(c.checkCollision(head), null)
})
test('boosted head crossing a body between two frames still kills', () => {
  const c = client(); c.receiveSnakeState(packet(), 'peer'); c.updateRemoteSnakes(.1)
  const before = { x: 23.5, y: .32, z: 9.5 }, after = { x: 23.5, y: .32, z: 11.5 }
  assert.equal(c.checkCollision(before), null)
  assert.equal(c.checkCollision(after), null)
  assert.equal(c.checkCollision(after, before).killerId, 'other')
})
test('server death at the same sequence clears a live opponent immediately', () => {
  const c = client(); c.receiveSnakeState(packet(), 'peer'); c.updateRemoteSnakes(.1)
  c.receiveSnakeState(packet({ phase: 'gameover', points: [] }), 'server')
  assert.equal(c.checkCollision(head), null)
  assert.equal(c.remoteSnakes.get('other').phase, 'gameover')
})
test('server remains arriving before the death snapshot remove the lethal body', () => {
  const c = client(); const food = sharedFood(c)
  c.SnakeSnapshot.create(c.engine.addEntity(), { epoch: 1, payload: JSON.stringify(packet()) })
  c.receiveServerSnakes(); c.updateRemoteSnakes(.1)
  assert.ok(c.checkCollision(head))
  Object.assign(c.SharedFood.getMutable(food), { dropped: true, ownerId: 'other', session: 1, run: 1, sequence: 10 })
  c.receiveServerSnakes(); c.updateRemoteSnakes(.1)
  assert.equal(c.checkCollision(head), null)
  assert.equal(c.remoteSnakes.get('other').phase, 'gameover')
})
test('server-detected collision ends the local game even when no local hit was reported', () => {
  const c = client(); c.prepareDeath()
  c.ServerStatus.create(c.engine.addEntity(), { epoch: 1, heartbeat: 1 })
  c.SnakeSnapshot.create(c.engine.addEntity(), { epoch: 1, payload: JSON.stringify(packet({
    playerId: 'local', session: c.stats().session, run: c.stats().run, phase: 'gameover',
    points: [], killerId: 'other', deathReason: 'Blocked by Rival'
  })) })
  c.receiveServerSnakes()
  assert.equal(c.stats().phase, 'gameover')
  assert.equal(c.stats().renderedSegmentCount, 0)
  c.receiveServerSnakes()
  assert.equal(c.stats().phase, 'gameover')
})
test('crown follows living length, ignoring kill score and dead leaders', () => {
  const c = client()
  c.ServerStatus.create(c.engine.addEntity(), { epoch: 1, heartbeat: 1 })
  const make = (playerId, length, score, phase = 'running') => {
    const entity = c.engine.addEntity(); c.MatchPlayer.create(entity, { epoch: 1, playerId, length, score, phase }); return entity
  }
  const a = make('local', 20, 200), b = make('other', 30, 30)
  make('dead', 100, 1000, 'gameover')
  assert.equal(c.crownLeader().playerId, 'other')
  c.MatchPlayer.getMutable(b).phase = 'gameover'
  assert.equal(c.crownLeader().playerId, 'local')
  c.MatchPlayer.getMutable(a).phase = 'exited'
  assert.equal(c.crownLeader(), undefined)
})
test('two clients converge after differently ordered movement and death evidence', () => {
  const a = client(), b = client()
  a.receiveSnakeState(packet(), 'peer'); a.drop(); a.expireDeathDrops()
  b.drop(); b.expireDeathDrops(); b.receiveSnakeState(packet(), 'peer')
  const respawn = packet({ run: 2, sequence: 30 })
  for (const c of [a, b]) {
    c.receiveSnakeState(respawn, 'peer'); c.receiveSnakeState(packet(), 'peer'); c.expireDeathDrops()
    assert.equal(c.remoteSnakes.get('other').phase, 'running')
    assert.equal(c.remoteSnakes.get('other').sequence, 30)
  }
})
test('spawned death food stays at eating height and has no mesh collider', () => {
  const c = client(); c.explodeIntoEnergy(head, 20)
  for (const [entity] of c.engine.getEntitiesWith(c.DeathDropState)) {
    assert.equal(c.ecs.Transform.get(entity).position.y, .28)
    assert.equal(c.ecs.MeshCollider.has(entity), false)
  }
})
const uiCode = esbuild.buildSync({ stdin: { contents: fs.readFileSync(path.join(root, 'src/ui.tsx'), 'utf8') + '\nexport const testUi = { QuickTutorial, GameUi, openTutorial, layout, Leaderboard, RestScreen, CollectionMenu }', resolveDir: path.join(root, 'src'), loader: 'tsx' }, jsxFactory: 'ReactEcs.createElement', bundle: true, write: false, platform: 'node', format: 'cjs', external: ['@dcl/*', './snake-game'] }).outputFiles[0].text
function uiClient(width, height, mobile, rows = []) {
  let starts = 0
  const view = { phase: 'ready', menuSession: 1, menuOpen: false, musicEnabled: true, soundEnabled: true }
  const uiModule = { exports: {} }
  const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(Boolean) }) }
  vm.runInNewContext(uiCode, {
    module: uiModule, exports: uiModule.exports,
    require: name => {
      if (name === '@dcl/sdk/math') return mathModule.exports
      if (name === '@dcl/sdk/react-ecs') return { ...react, UiEntity: 'UiEntity', Label: 'Label' }
      if (name === '@dcl/sdk/ecs') return { engine: { RootEntity: 0 }, UiCanvasInformation: { getOrNull: () => ({ width, height }) } }
      if (name === '@dcl/sdk/platform') return { isMobile: () => mobile }
      if (name === './snake-game') return { snakeSkins: Array.from({length:8}, (_, i) => ({name: 'Skin'+i, head: mathModule.exports.Color4.White(), bodyA: mathModule.exports.Color4.White(), bodyB: mathModule.exports.Color4.White()})), snakeHats: [], isSkinUnlocked: () => true, getExperimentView: () => view, startRun: () => starts++, matchLeaderboard: () => rows, globalLeaderboard: () => rows, playUiClickSound() {}, toggleMusic() {}, toggleSound() {} }
      throw new Error(`Unexpected UI import ${name}`)
    }
  })
  return { ...uiModule.exports.testUi, starts: () => starts }
}
function walk(node) { return node ? [node, ...node.children.flatMap(walk)] : [] }
function button(tree, label) { return walk(tree).find(n => n.props.onMouseDown && walk(n).some(c => c.props.value === label)) }
test('leaderboard keeps every player with horizontal overflow only when needed', () => {
  for (const count of [2, 30]) {
    const rows = Array.from({ length: count }, (_, i) => ({ playerId: `p${i}`, name: `PLAYER${i}`, score: i }))
    const ui = uiClient(1920, 1080, false, rows), tree = ui.Leaderboard(ui.layout())
    assert.equal(walk(tree).filter(n => String(n.props.value).includes('. PLAYER')).length, count)
    const scroll = walk(tree).find(n => n.props.uiTransform?.overflow === 'scroll')
    if (count === 2) assert.equal(scroll, undefined)
    else {
      assert.equal(scroll.children[0].props.uiTransform.flexDirection, 'row')
      assert.ok(scroll.children[0].props.uiTransform.height < scroll.props.uiTransform.height)
    }
  }
})
test('music toggle has room for a single readable line on desktop and mobile', () => {
  for (const mobile of [false, true]) {
    const ui = uiClient(mobile ? 844 : 1920, mobile ? 390 : 1080, mobile)
    const tree = ui.RestScreen(ui.layout()), music = button(tree, 'MUSIC ON')
    const label = walk(music).find(n => n.props.value === 'MUSIC ON')
    assert.ok(music.props.uiTransform.width > label.props.fontSize * 6.5)
    assert.ok(music.props.uiTransform.height > label.props.fontSize * 1.3)
  }
})
for (const [width, height, mobile] of [[568, 320, true], [667, 375, true], [844, 390, true], [390, 844, true], [1920, 1080, false]]) {
  test(`tutorial fits ${width}x${height} ${mobile ? 'mobile' : 'desktop'} with explicit text boxes`, () => {
    const ui = uiClient(width, height, mobile), l = ui.layout(), tree = ui.QuickTutorial(l)
    assert.ok(tree.props.uiTransform.height <= l.p(l.height - 24))
    assert.ok(tree.props.uiTransform.width <= l.p(l.width - 24))
    for (const label of walk(tree).filter(n => n.type === 'Label')) {
      assert.ok(label.props.uiTransform.width && label.props.uiTransform.height)
    }
    if (height < 354) {
      button(tree, 'NEXT').props.onMouseDown()
      const page2 = ui.QuickTutorial(l)
      assert.ok(walk(page2).some(n => n.props.value === 'SURVIVE'))
      button(page2, 'GOT IT - PLAY').props.onMouseDown()
    } else button(tree, 'GOT IT - PLAY').props.onMouseDown()
    assert.equal(ui.starts(), 1)
  })
}
test('start menu opens tutorial and BACK returns to the menu', () => {
  const ui = uiClient(844, 390, true)
  button(ui.GameUi(), 'HOW TO PLAY').props.onMouseDown()
  assert.ok(button(ui.GameUi(), 'GOT IT - PLAY'))
  button(ui.GameUi(), 'BACK').props.onMouseDown()
  assert.ok(button(ui.GameUi(), 'HOW TO PLAY'))
  assert.equal(ui.starts(), 0)
})
test('only buffered server poses move the local snake; callbacks and old packets cannot snap it', () => {
  const c = client(), api = c.api || c
  const state = api.stats()
  const packet = { playerId: 'local', session: state.session, run: state.run,
    phase: 'running', sequence: 100, ack: 5, earned: 2, sampleTime: 1000,
    points: [{x:16,z:16},{x:16,z:15}],
    motion: {x:16,z:16,heading:0,spent:0,boostTimer:0} }
  const old = { ...api.headPosition() }
  api.applyServerPacket(packet)
  assert.equal(api.headPosition().z, old.z, 'arrival callback never moves the displayed head')
  api.presentationClock.time = 1000
  api.renderOwnSnake()
  assert.equal(api.headPosition().z, 16)
  api.applyServerPacket({...packet, sequence:99, motion:{...packet.motion,z:1}})
  api.presentationClock.time = 2000
  api.renderOwnSnake()
  assert.equal(api.headPosition().z, 16, 'no server updates means no invented movement')
  api.applyServerPacket({...packet, sequence:101, sampleTime:2100,
    points:[{x:16,z:16.42},{x:16,z:15.42}], motion:{...packet.motion,z:16.42}})
  api.presentationClock.time = 1550
  api.renderOwnSnake()
  assert.ok(api.headPosition().z > 16 && api.headPosition().z < 16.42, 'display smoothly approaches confirmed poses')
})
for (const [width,height,mobile] of [[1538,816,false],[1920,1080,false],[800,600,false],[844,390,true]]) {
  test(`collection scroll behavior ${width}x${height} mobile=${mobile}`, () => {
    const ui = uiClient(width,height,mobile), l=ui.layout(), tree=ui.CollectionMenu(l)
    const nodes = walk(tree)
    const scrolls = nodes.filter(n => n.props.uiTransform?.overflow === 'scroll')
    assert.equal(scrolls.length, mobile ? 1 : 0)
    const cards = nodes.filter(n => String(n.props.key || '').startsWith('skin-'))
    assert.equal(cards.length, 8, 'every skin remains visible/reachable')
    if (!mobile) {
      const used = cards.reduce((sum,n) => sum + n.props.uiTransform.width + l.p(10),0)
      assert.ok(used <= l.p(l.panelWidth-50), 'all cards fit without a clipped overflow rail')
    }
  })
}
console.log(`${passed} gameplay and tutorial regression checks passed.`)

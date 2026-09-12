const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const esbuild = require('esbuild')
const frames = []
const stores = [], handlers = new Map(), systems = []
let nextId = 512, now = 1000000
function component() {
  const data = new Map()
  const c = { componentId: stores.length, create: (id, value = {}) => data.set(id, structuredClone(value)),
    createOrReplace: (id, value) => data.set(id, structuredClone(value)),
    has: id => data.has(id), get: id => data.get(id), getOrNull: id => data.get(id),
    getMutable: id => data.get(id), validateBeforeChange() {} }
  stores.push(data); return c
}
const engine = { defineComponent: component, addEntity: () => nextId++, addSystem: fn => systems.push(fn),
  removeEntity: id => stores.forEach(s => s.delete(id)) }
const code = esbuild.buildSync({ stdin: { contents: fs.readFileSync('src/multiplayer-server.ts', 'utf8') +
  '\nexport const fixture = { items, peers, SharedFood, MatchPlayer, SnakeSnapshot };', resolveDir: process.cwd() + '/src', loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['@dcl/*'] }).outputFiles[0].text
const output = { exports: {} }
vm.runInNewContext(code, { module: output, exports: output.exports, console, Date: class extends Date { static now() { return now } }, Math,
  require(name) {
    if (name === '@dcl/sdk/ecs') return { engine, executeTask() {}, Schemas: new Proxy({}, { get: () => () => ({}) }) }
    if (name === '@dcl/sdk/network') return { syncEntity() {}, registerMessages: () => ({ send: (kind, payload) => frames.push({ kind, payload }), onMessage: (key, fn) => handlers.set(key, fn) }) }
    if (name === '@dcl/sdk/network/message-bus-sync') return { AUTH_SERVER_PEER_ID: 'server' }
    if (name === '@dcl/sdk/server') return { Storage: {} }
    if (name === '@dcl/sdk/math') return { Color4: { fromHexString: hex => ({ r: parseInt(hex.slice(1,3),16)/255, g: parseInt(hex.slice(3,5),16)/255, b: parseInt(hex.slice(5,7),16)/255, a: parseInt(hex.slice(7,9),16)/255 }) },
      Vector3: { create: (x,y,z) => ({x,y,z}), distanceSquared: (a,b) => (a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2 } }
    throw new Error(name)
  }
})
output.exports.initMultiplayerServer()
const { items, peers, SharedFood, SnakeSnapshot } = output.exports.fixture
assert.equal(items.size, 60, 'server starts a denser random food field')
const send = (address, sequence, extra = {}) => handlers.get('snakePresence')({ payload: JSON.stringify({
  playerId: address + ':session', name: address, phase: 'running', session: 1, run: 1,
  sequence, spent: 0, skin: 0, turn: 0, points: [{ x: 10, z: 10 }], ...extra
}) }, { from: address })
const tick = (count = 1) => { for (let i = 0; i < count; i++) { now += 34; systems.forEach(fn => fn()) } }
send('alice', 1); send('bob', 1)
const alice = peers.get('alice'), bob = peers.get('bob')
assert.notEqual(alice.motion.x, 10, 'client supplied positions are not authoritative')
const before = { ...alice.motion }
send('alice', 2, { points: [{ x: 30, z: 30 }], heading: 99, spent: 999 })
assert.equal(alice.motion.x, before.x, 'forged teleport ignored')
assert.equal(alice.state.spent, 0, 'forged boost expenditure ignored')
tick(4)
assert.ok(Math.hypot(alice.motion.x-before.x, alice.motion.z-before.z) > .2, 'server advances without client poses')
assert.ok(Math.hypot(alice.motion.x-before.x, alice.motion.z-before.z) < .7, 'cruising speed is bounded at 3.8 m/s')
assert.ok(frames.some(f => f.kind === 'arenaFrames'), 'fast authoritative snapshots broadcast')
const food = SharedFood.getMutable(items.get('food-0'))
food.position = { x: alice.motion.x, y: .28, z: alice.motion.z }
food.dropped = true; food.expiresAt = now + 20000; food.value = 3
const earned = alice.earned
tick()
assert.equal(food.active, false)
assert.equal(alice.earned, earned + 3, 'server collects food without waiting for claims')
assert.equal(alice.state.phase, 'running', 'death food does not kill')
const beforeControl = { ...alice.motion }
send('alice', 3, { steer: 1, boosting: true, mobile: true, pointerTurn: 99999 })
assert.deepEqual({ ...alice.motion }, beforeControl, 'control receipts do not advance positions between ticks')
tick(3)
assert.ok(alice.motion.heading > beforeControl.heading, 'server integrates requested steering')
assert.ok(alice.steeringVelocity > 0 && alice.steeringVelocity <= 3.8, 'server enforces mobile steering limit')
assert.equal(alice.state.pointerTurn, 0, 'mobile input cannot inject mouse steering')
assert.equal(alice.activeBoost, true, 'server decides boost activation')
now += 550; systems.forEach(fn => fn())
assert.equal(alice.activeBoost, false, 'stale controls release boost')
assert.equal(alice.steeringVelocity, 0, 'stale controls release steering')
handlers.get('snakeDeath')({ payload: JSON.stringify({
  victimId: alice.state.playerId, session: 1, run: 1, sequence: 50, reason: 'fake death',
  points: [{ x: 1, z: 1 }]
}) }, { from: 'alice' })
assert.equal(alice.state.phase, 'running', 'client cannot decide death')
send('alice', 4, { phase: 'gameover' })
assert.equal(alice.state.phase, 'running', 'client terminal snapshot cannot decide death')
send('charlie', 1)
const charlie = peers.get('charlie')
charlie.started = now - 3000
charlie.motion = { x: 0.7, z: 16, heading: 0, spent: 0, boostTimer: 0 }
charlie.points = [{ x: 0.7, z: 16 }, { x: 2, z: 16 }]
tick()
assert.equal(charlie.state.phase, 'gameover', 'server kills when the snake reaches the fence limit')
// Deterministic server fixture puts a head on a crossing course after spawn protection.
alice.started = now - 3000; bob.started = now - 3000
alice.motion = { x: 15.7, z: 16, heading: Math.PI/2, spent: 0, boostTimer: 0 }
alice.points = [{x:15.7,z:16},{x:14,z:16}]
bob.motion = { x: 16, z: 17, heading: 0, spent: 0, boostTimer: 0 }
bob.points = [{x:16,z:17},{x:16,z:16},{x:16,z:15}]
tick()
assert.equal(alice.state.phase, 'gameover', 'server detects head/body contact')
assert.equal(bob.kills, 1)
// A completed loop must use the same head/body radius as rival contact. This
// guards against a visible self-graze sometimes being accepted by the server.
bob.motion = { x: 16, z: 16, heading: 0, spent: 0, boostTimer: 0 }
bob.points = [{ x: 16, z: 16 }, { x: 16, z: 15 }, { x: 15, z: 15 }, { x: 15, z: 17 }, { x: 16, z: 16.3 }]
bob.earned = 12
bob.started = now - 3000
tick()
assert.equal(bob.state.phase, 'gameover', 'server detects a swept self-body collision')
const drops = [...items.values()].map(e => SharedFood.getOrNull(e)).filter(f => f?.ownerId === alice.state.playerId)
assert.ok(drops.length > 0, 'authoritative death creates remains')
for (let i = 0; i < drops.length; i++) {
  const rgb = i % 2 === 0 ? [185,70,240] : [123,43,196]
  assert.deepEqual([drops[i].color.r, drops[i].color.g, drops[i].color.b], rgb.map(c => c/255), 'death food matches Violet body colors, not random arena food')
}
assert.ok(drops.every(f => f.expiresAt > now + 44500), 'remains have forty-five-second lifetime')
send('alice', 4)
assert.equal(alice.state.phase, 'gameover', 'late input cannot resurrect')
assert.equal(bob.kills, 1, 'death credit is exactly once')
const terminal = JSON.parse(SnakeSnapshot.get(alice.entity).payload)
assert.equal(terminal.phase, 'gameover')
assert.ok(drops.every(f => f.sequence <= terminal.sequence), 'death proof uses server revisions')
// Every receiver gets the same immutable frame, independent of local render rate.
const deliveries = frames.filter(f => f.kind === 'arenaFrames').flatMap(f => f.payload.frames).map(JSON.parse)
assert.ok(deliveries.some(p => p.playerId === alice.state.playerId && p.phase === 'gameover'))
assert.ok(deliveries.every(p => p.points.length <= 36), 'movement frames stay bounded')
now += 45001; systems.forEach(fn => fn())
assert.ok(drops.every(f => !f.active), 'remains expire after forty-five seconds')
send('alice', 5, { run: 2 })
assert.equal(peers.get('alice').state.phase, 'running', 'next life starts normally')
assert.equal(peers.get('alice').motion.spent, 0)
console.log('PASS authoritative spawn, movement, speed, food, collision, death ordering, remains expiry, restart and snapshot transport')

const assert = require('node:assert/strict')
const vm = require('node:vm')
const esbuild = require('esbuild')
const code = esbuild.buildSync({ entryPoints: ['src/netcode.ts'], bundle: true,
  write: false, platform: 'node', format: 'cjs' }).outputFiles[0].text
const moduleUnderTest = { exports: {} }
vm.runInNewContext(code, { module: moduleUnderTest, exports: moduleUnderTest.exports, Math })
const { SnapshotTrack, PresentationClock, stepMotion, BASE_SPEED, MAX_TURN_RATE } = moduleUnderTest.exports
assert.equal(BASE_SPEED, 3.04)
const motion = { x: 0, z: 0, heading: 0, spent: 0, boostTimer: 0 }
stepMotion(motion, 0, false, 20, 1/30)
assert.equal(motion.speed, BASE_SPEED)
const firstBoost = stepMotion(motion, 0, true, 20, 1/30)
assert.ok(firstBoost > BASE_SPEED && firstBoost < BASE_SPEED * 1.72, 'boost ramps up without a speed jump')
for (let i=0; i<30; i++) stepMotion(motion, 0, true, 20, 1/30)
assert.ok(Math.abs(motion.speed - BASE_SPEED * 1.72) < .001)
const release = stepMotion(motion, 0, false, 20, 1/30)
assert.ok(release > BASE_SPEED && release < BASE_SPEED * 1.72, 'boost release eases down')
for (let i=0; i<30; i++) stepMotion(motion, MAX_TURN_RATE, false, 20, 1/30)
assert.ok(motion.speed >= BASE_SPEED * .65 - .001, 'corners retain momentum instead of feeling stuck')
console.log('PASS slower cruising, smooth boost transitions and corner momentum')
const pose = at => ({ at, heading: 0, speed: 4.2,
  points: [{ x: 0, z: (at - 1000) * .0042 }, { x: 0, z: (at - 1000) * .0042 - 2 }] })
for (const fps of [30, 60, 144]) {
  const track = new SnapshotTrack(), clock = new PresentationClock()
  // Delays, reordering and dropped updates, followed by a 400 ms outage.
  const deliveries = []
  for (let i = 0; i < 160; i++) {
    if (i % 7 === 3 || (i >= 80 && i < 88)) continue
    const at = 1000 + i * 50
    deliveries.push({ arrival: at + 60 + (i * 37 % 90), frame: pose(at) })
  }
  deliveries.sort((a, b) => a.arrival - b.arrival)
  let previous, lastTime = 0, largestStep = 0
  for (let now = 1000; now < 9200; now += 1000 / fps) {
    while (deliveries.length && deliveries[0].arrival <= now) {
      const packet = deliveries.shift()
      track.push(packet.frame); clock.observe(packet.frame.at, now)
    }
    clock.advance(now, 1 / fps)
    const sample = track.sample(clock.time)
    assert.ok(clock.time >= lastTime, 'render clock never rewinds')
    lastTime = clock.time
    if (!sample) continue
    if (previous !== undefined) {
      const step = sample.points[0].z - previous
      assert.ok(step >= -1e-9, 'no backward snap under packet jitter')
      largestStep = Math.max(largestStep, step)
      assert.ok(step <= 4.2 / fps * 1.151 + 1e-8, 'no packet-arrival teleport')
    }
    previous = sample.points[0].z
  }
  const stopped = track.sample(999999).points[0].z
  assert.equal(stopped, pose(8950).points[0].z, 'never extrapolates beyond confirmed state')
  console.log(`PASS ${fps} FPS: jitter/reorder/loss/outage, largest movement/frame ${largestStep.toFixed(4)} m`)
}
const angles = new SnapshotTrack()
angles.push({ ...pose(1000), heading: Math.PI - .1 })
angles.push({ ...pose(1100), heading: -Math.PI + .1 })
assert.ok(Math.abs(angles.sample(1050).heading - Math.PI) < 1e-9, 'heading interpolation uses shortest arc')
console.log('PASS confirmed-pose interpolation and angle wrapping')

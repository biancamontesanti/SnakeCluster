const assert = require('node:assert/strict')
const vm = require('node:vm')
const esbuild = require('esbuild')
const code = esbuild.buildSync({ entryPoints: ['src/camera-rig.ts'], bundle: true, write: false, format: 'cjs', platform: 'node' }).outputFiles[0].text
const output = { exports: {} }
vm.runInNewContext(code, { module: output, exports: output.exports, Math })
const { CameraRig } = output.exports
for (const fps of [30, 60, 144]) {
  const rig = new CameraRig()
  let position = { x: 16, y: 3.8, z: 10.4 }
  rig.reset(position, { x: 16, y: .2, z: 16 }, 0)
  const first = rig.update(position, { x: 18, y: .2, z: 16 }, .5, 1/fps)
  assert.ok(Math.abs(first.target.x - 16) < .21, 'look-at target does not snap to a new packet')
  assert.ok(Math.abs(first.position.x - 16) < .1, 'camera position does not jump')
  for (let i=0; i<fps*3; i++) {
    const result = rig.update(position, { x: 18, y: .2, z: 16 }, .5, 1/fps)
    position = result.position
    assert.ok(Object.values(position).every(Number.isFinite))
  }
  assert.ok(Math.abs(position.x - (18-Math.sin(.5)*5.6)) < .01, 'rig settles accurately')
  console.log(`PASS damped camera aim and position at ${fps} FPS`)
}
const rig = new CameraRig(), p = {x:16,y:3.8,z:21.6}, t = {x:16,y:.2,z:16}
rig.reset(p,t,Math.PI-.01)
const wrap = rig.update(p,t,-Math.PI+.01,1/60)
assert.ok(Math.abs(wrap.position.x-16)<.01, 'heading wrap does not spin camera around arena')
console.log('PASS shortest-arc camera rotation')

// Bake uniform scale and translation into the ORIGINAL geometry. No remeshing,
// simplification, materials, UVs, normals or triangle indices are changed.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const factors = { Crown: 0.0000009, Pirate: 0.045, Santa: 4.2, Sombrero: 0.00000072, Witch: 0.55 }
for (const [name, factor] of Object.entries(factors)) {
  const source = fs.readFileSync(path.join(__dirname, '../assets/Models', name + '.glb'))
  const jsonLength = source.readUInt32LE(12)
  const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString())
  const binHeader = 20 + jsonLength
  assert.equal(source.readUInt32LE(binHeader + 4), 0x004e4942)
  const bin = Buffer.from(source.subarray(binHeader + 8, binHeader + 8 + source.readUInt32LE(binHeader)))
  assert(!json.animations?.length && !json.skins?.length, 'Static headwear only')
  const changed = new Set()
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
  for (const node of json.nodes) {
    assert(!node.matrix && !node.rotation && !node.scale && !node.children?.length, 'Unexpected hierarchy: audit before baking')
    if (node.mesh === undefined) continue
    const translation = node.translation || [0, 0, 0]
    for (const primitive of json.meshes[node.mesh].primitives) {
      assert(!primitive.targets && !primitive.extensions, 'Unexpected compressed/morphed mesh')
      const id = primitive.attributes.POSITION
      assert(!changed.has(id), 'Shared POSITION accessor needs a separate copy')
      changed.add(id)
      const accessor = json.accessors[id]
      assert(accessor.componentType === 5126 && accessor.type === 'VEC3' && !accessor.sparse)
      const view = json.bufferViews[accessor.bufferView]
      const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0)
      const stride = view.byteStride || 12
      accessor.min = [Infinity, Infinity, Infinity]
      accessor.max = [-Infinity, -Infinity, -Infinity]
      for (let vertex = 0; vertex < accessor.count; vertex++) for (let axis = 0; axis < 3; axis++) {
        const address = offset + vertex * stride + axis * 4
        const fitted = (bin.readFloatLE(address) + translation[axis]) * factor
        bin.writeFloatLE(fitted, address)
        const value = bin.readFloatLE(address)
        assert(Number.isFinite(value))
        accessor.min[axis] = Math.min(accessor.min[axis], value)
        accessor.max[axis] = Math.max(accessor.max[axis], value)
        bounds.min[axis] = Math.min(bounds.min[axis], value)
        bounds.max[axis] = Math.max(bounds.max[axis], value)
      }
    }
    node.translation = [0, 0, 0]
  }
  const encoded = Buffer.from(JSON.stringify(json))
  const padded = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 0x20)
  encoded.copy(padded)
  const header = Buffer.alloc(20)
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4)
  header.writeUInt32LE(20 + padded.length + 8 + bin.length, 8)
  header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
  const binaryHeader = Buffer.alloc(8)
  binaryHeader.writeUInt32LE(bin.length); binaryHeader.writeUInt32LE(0x004e4942, 4)
  fs.writeFileSync(path.join(__dirname, '../assets/Models', name + '-fitted.glb'), Buffer.concat([header, padded, binaryHeader, bin]))
  console.log(name, JSON.stringify({ factor, ...bounds, size: bounds.max.map((v, i) => v - bounds.min[i]) }))
}

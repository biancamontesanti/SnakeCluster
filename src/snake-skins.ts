import { Color4 } from '@dcl/sdk/math'

export type SnakeSkin = {
  name: string
  head: Color4
  bodyA: Color4
  bodyB: Color4
  special?: boolean
  goal?: string
  unlockAt?: number
}

export const snakeSkins: SnakeSkin[] = [
  { name: 'Violet', head: Color4.fromHexString('#9c2ee8ff'), bodyA: Color4.fromHexString('#b946f0ff'), bodyB: Color4.fromHexString('#7b2bc4ff') },
  { name: 'Aqua', head: Color4.fromHexString('#1cc7d5ff'), bodyA: Color4.fromHexString('#42dce5ff'), bodyB: Color4.fromHexString('#1098b3ff') },
  { name: 'Lime', head: Color4.fromHexString('#6ed629ff'), bodyA: Color4.fromHexString('#91ec39ff'), bodyB: Color4.fromHexString('#43a824ff') },
  { name: 'Solar', head: Color4.fromHexString('#ffb51bff'), bodyA: Color4.fromHexString('#ffd13bff'), bodyB: Color4.fromHexString('#f28716ff') },
  { name: 'Rose', head: Color4.fromHexString('#e91e83ff'), bodyA: Color4.fromHexString('#ff4ca0ff'), bodyB: Color4.fromHexString('#aa1264ff') }
  ,{ name: 'Royal', head: Color4.fromHexString('#4933d5ff'), bodyA: Color4.fromHexString('#725bffff'), bodyB: Color4.fromHexString('#ffd45cff'), special: true, goal: 'Collect 75 energy', unlockAt: 75 }
  ,{ name: 'Inferno', head: Color4.fromHexString('#ff3c21ff'), bodyA: Color4.fromHexString('#ff7a1aff'), bodyB: Color4.fromHexString('#ffd34dff'), special: true, goal: 'Collect 200 energy', unlockAt: 200 }
  ,{ name: 'Diamond', head: Color4.fromHexString('#71e8ffff'), bodyA: Color4.fromHexString('#d8fbffff'), bodyB: Color4.fromHexString('#6ea8ffff'), special: true, goal: 'Collect 500 energy', unlockAt: 500 }
]

export function deathFoodColor(skinIndex: number, piece: number): Color4 {
  const index = Number.isFinite(skinIndex) ? Math.max(0, Math.min(snakeSkins.length - 1, Math.floor(skinIndex))) : 0
  const skin = snakeSkins[index]
  return piece % 2 === 0 ? skin.bodyA : skin.bodyB
}

import { engine, Schemas } from '@dcl/sdk/ecs'
import { registerMessages } from '@dcl/sdk/network'

export const FOOD_PICKUP_RADIUS_SQUARED = 0.32

export const SnakeSnapshot = engine.defineComponent('snakeCluster::snakeSnapshotV1', {
  epoch: Schemas.Int64, payload: Schemas.String
})

// Defined during module load on both client and server, before ECS sealing.
export const SharedFood = engine.defineComponent('snakeCluster::serverFoodV2', {
  epoch: Schemas.Int64, id: Schemas.String, revision: Schemas.Int,
  position: Schemas.Vector3, color: Schemas.Color4, size: Schemas.Float,
  active: Schemas.Boolean, dropped: Schemas.Boolean, expiresAt: Schemas.Int64, value: Schemas.Int,
  ownerId: Schemas.String, session: Schemas.Int64, run: Schemas.Int, sequence: Schemas.Int
})
export const ServerStatus = engine.defineComponent('snakeCluster::serverStatusV1', {
  epoch: Schemas.Int64, heartbeat: Schemas.Int64, loading: Schemas.Boolean, pendingSaves: Schemas.Int
})
export const MatchPlayer = engine.defineComponent('snakeCluster::matchPlayerV2', {
  epoch: Schemas.Int64, address: Schemas.String, playerId: Schemas.String, name: Schemas.String,
  score: Schemas.Int, best: Schemas.Int, run: Schemas.Int, earned: Schemas.Int, kills: Schemas.Int,
  phase: Schemas.String, length: Schemas.Int
})
export const SavedScore = engine.defineComponent('snakeCluster::savedScoreV1', {
  epoch: Schemas.Int64, rank: Schemas.Int, address: Schemas.String, name: Schemas.String, score: Schemas.Int
})
export const room = registerMessages({
  arenaFrames: Schemas.Map({ epoch: Schemas.Int64, frames: Schemas.Array(Schemas.String) }),
  ping: Schemas.Map({ sentAt: Schemas.Int64 }),
  pong: Schemas.Map({ sentAt: Schemas.Int64, serverAt: Schemas.Int64 }),
  snakePresence: Schemas.Map({ payload: Schemas.String }),
  snakeDeath: Schemas.Map({ payload: Schemas.String }),
  collectFood: Schemas.Map({ playerId: Schemas.String, run: Schemas.Int, x: Schemas.Float, z: Schemas.Float, items: Schemas.Array(Schemas.Map({ id: Schemas.String, revision: Schemas.Int })) })
})

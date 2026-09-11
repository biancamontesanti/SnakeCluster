import { engine } from '@dcl/sdk/ecs'
import { isStateSyncronized } from '@dcl/sdk/network'
import { ServerStatus } from './multiplayer-state'

let seenHeartbeat = 0, observedAt = 0, activeEpoch = 0
export function serverConnection() {
  if (!isStateSyncronized()) return { ready: false, epoch: 0, message: 'CONNECTING TO ARENA...' }
  for (const [, value] of engine.getEntitiesWith(ServerStatus)) {
    if (value.epoch < activeEpoch) continue
    if (value.heartbeat !== seenHeartbeat) {
      seenHeartbeat = value.heartbeat; observedAt = Date.now(); activeEpoch = value.epoch
    }
  }
  // The server heartbeat is synced once per second. Allow a short delivery
  // gap so food pickup does not stop during normal CRDT batching or wake-up.
  const ready = observedAt > 0 && Date.now() - observedAt < 15000
  return { ready, epoch: activeEpoch, message: ready ? '' : 'ARENA IS WAKING UP...' }
}

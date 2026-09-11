import { engine } from '@dcl/sdk/ecs'
import { createSnakeExperiment, snakeGameSystem } from './snake-game'
import { setupUi } from './ui'
import { isServer } from '@dcl/sdk/network'
import './multiplayer-state'

export async function main() {
  if (isServer()) {
    const { initMultiplayerServer } = await import('./multiplayer-server')
    initMultiplayerServer()
    return
  }
  createSnakeExperiment()
  engine.addSystem(snakeGameSystem)
  setupUi()
}

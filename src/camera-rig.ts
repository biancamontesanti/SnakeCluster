type Point = { x: number; y: number; z: number }
type Spring = { value: number; velocity: number }
function damp(s: Spring, target: number, omega: number, dt: number) {
  const offset = s.value - target
  const c = s.velocity + omega * offset
  const decay = Math.exp(-omega * dt)
  s.value = target + (offset + c * dt) * decay
  s.velocity = (s.velocity - omega * c * dt) * decay
}

/** Cosmetic camera rig only. Never feeds movement, food or collision decisions. */
export class CameraRig {
  private axes: Spring[] = []
  private focus: Spring[] = []
  private yaw: Spring = { value: 0, velocity: 0 }
  reset(position: Point, target: Point, heading: number) {
    this.axes = [position.x, position.y, position.z].map(value => ({ value, velocity: 0 }))
    this.focus = [target.x, .2, target.z].map(value => ({ value, velocity: 0 }))
    this.yaw = { value: heading, velocity: 0 }
  }
  update(position: Point, target: Point, heading: number, dt: number) {
    if (!this.axes.length) this.reset(position, target, heading)
    dt = Math.max(0, Math.min(.05, dt))
    const angle = this.yaw.value + Math.atan2(Math.sin(heading - this.yaw.value), Math.cos(heading - this.yaw.value))
    damp(this.yaw, angle, 9, dt)
    ;[target.x, .2, target.z].forEach((v, i) => damp(this.focus[i], v, 16, dt))
    const desired = [
      Math.max(.5, Math.min(31.5, this.focus[0].value - Math.sin(this.yaw.value) * 5.6)),
      3.8,
      Math.max(.5, Math.min(31.5, this.focus[2].value - Math.cos(this.yaw.value) * 5.6))
    ]
    desired.forEach((v, i) => damp(this.axes[i], v, 12, dt))
    return {
      position: { x: this.axes[0].value, y: this.axes[1].value, z: this.axes[2].value },
      target: { x: this.focus[0].value, y: this.focus[1].value, z: this.focus[2].value }
    }
  }
}

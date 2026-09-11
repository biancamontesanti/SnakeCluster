/** Pointer travel, not pointer location, steers the snake. Values are radians/sec. */
export function mouseTurnRate(deltaX: number, dt: number): number {
  if (!Number.isFinite(deltaX) || !Number.isFinite(dt) || dt <= 0 || dt > 0.15) return 0
  const pixelsPerSecond = deltaX / dt
  if (Math.abs(pixelsPerSecond) < 12) return 0
  // A firmer drag response makes deliberate mouse sweeps translate into a
  // confident turn before the server's safe turn-rate cap takes over.
  return Math.max(-2.9, Math.min(2.9, pixelsPerSecond * 0.0048))
}

export function keyboardTurnRate(previous: number, direction: number, dt: number, maxRate = 6.4, response = 15): number {
  // Releasing the input stops steering immediately; acceleration stays gentle.
  // Mobile passes a lower rate and softer response so the thumb stick cannot
  // snap the snake into its own body with a tiny correction.
  if (direction === 0) return 0
  return previous + (direction * maxRate - previous) * (1 - Math.exp(-Math.max(0, dt) * response))
}

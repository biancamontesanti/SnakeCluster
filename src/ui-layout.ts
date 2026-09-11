export type Insets = { top: number; bottom: number; left: number; right: number }

/** Match SDK 7.26+ virtual scaling, then keep phone controls in device pixels. */
export function calculateLayout(width: number, height: number, mobile: boolean, insets: Insets = { top: 0, bottom: 0, left: 0, right: 0 }) {
  width = width > 0 ? width : 1920
  height = height > 0 ? height : 1080
  const scale = Math.min(width / (mobile ? 1600 : 1920), height / (mobile ? 720 : 1080))
  const unit = mobile ? 1 / scale : 1
  const safeWidth = (width - insets.left - insets.right) / scale / unit
  const safeHeight = (height - insets.top - insets.bottom) / scale / unit
  const short = safeHeight < 500
  const narrow = safeWidth < 600
  const margin = mobile ? 12 : 36
  const panelWidth = Math.min(safeWidth - margin * 2, (mobile ? 820 : 1280) * 1.2)
  const cardWidth = (mobile ? (short ? 120 : 138) : 136) * 1.2
  // Includes explicit track clearance, button gap, padding and borders.
  const overhead = mobile ? 190 : 276
  const logoHeight = Math.max(20, Math.min((mobile ? (short ? 52 : 128) : 215) * 1.2, safeHeight - 24 - overhead - 100))
  const cardHeight = Math.max(86, Math.min((mobile ? (short ? 148 : 220) : 252) * 1.2, safeHeight - 24 - logoHeight - overhead))
  const panelHeight = Math.min(safeHeight - 24, logoHeight + cardHeight + overhead)
  return { unit, width: safeWidth, height: safeHeight, mobile, short, narrow, panelWidth, panelHeight, cardWidth, cardHeight, logoHeight, p: (value: number) => value * unit }
}

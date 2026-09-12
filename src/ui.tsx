import { Color4 } from '@dcl/sdk/math'
import { engine, UiCanvasInformation } from '@dcl/sdk/ecs'
import ReactEcs, { Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { isMobile } from '@dcl/sdk/platform'
import { calculateLayout } from './ui-layout'
import { equipHat, getExperimentView, globalLeaderboard, isHatOwned, isSkinUnlocked, leaveGame, matchLeaderboard, playUiClickSound, setSkin, snakeHats, snakeSkins, startRun, toggleMenu, toggleMusic, toggleSound } from './snake-game'

const C = {
  ink: Color4.fromHexString('#050505ff'), panel: Color4.fromHexString('#000000e6'), soft: Color4.fromHexString('#000000bd'),
  clear: Color4.fromHexString('#00000000'), white: Color4.fromHexString('#ffffffff'), muted: Color4.fromHexString('#e6e6e6ff'),
  lime: Color4.fromHexString('#baff3dff'), green: Color4.fromHexString('#baff3dff'), gold: Color4.fromHexString('#ffd84dff'),
  line: Color4.fromHexString('#baff3d99'), shade: Color4.fromHexString('#707070ff')
}
const LOGO = 'assets/images/ui/snake-cluster-logo.png'
const ORB = 'assets/images/ui/orb.png'
type Layout = ReturnType<typeof calculateLayout>
let collection: 'snakes' | 'hats' = 'snakes'
let leaderboardView: 'match' | 'global' = 'match'
let lastMenuSession = -1
let tutorialOpen = false
let tutorialPage = 0

function openTutorial() { tutorialPage = 0; tutorialOpen = true }

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(GameUi, { virtualWidth: 1920, virtualHeight: 1080, screenInset: 'device' })
}

function layout(): Layout {
  const canvas = UiCanvasInformation.getOrNull(engine.RootEntity)
  // The renderer already applies the device safe area. Passing those insets
  // into calculateLayout again shifted every panel inward a second time.
  return calculateLayout(canvas?.width ?? 1920, canvas?.height ?? 1080, isMobile())
}

function Text(value: string, width: number | '100%', height: number, size: number, l: Layout, color = C.white, align: 'middle-center' | 'middle-left' | 'middle-right' = 'middle-center') {
  const fontSize = size * 1.3 * (l.mobile ? (size <= 20 ? 1.1 : 1.05) : 1)
  return <Label value={value} fontSize={l.p(fontSize)} color={color} textAlign={align} textWrap='wrap' uiTransform={{ width: width === '100%' ? width : l.p(width), height: l.p(height), flexShrink: 0 }} />
}

function Logo(height: number, l: Layout) {
  return <UiEntity uiTransform={{ width: l.p(height * 1024 / 448), height: l.p(height), flexShrink: 0 }} uiBackground={{ texture: { src: LOGO }, textureMode: 'stretch', color: Color4.White() }} />
}

function Button(label: string, width: number, action: () => void, l: Layout, primary = true, height = 58, disabled = false) {
  const onClick = () => {
    if (disabled) return
    playUiClickSound()
    action()
  }
  return <UiEntity uiTransform={{ width: l.p(width), height: l.p(height), flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: l.p(12), borderWidth: 1, borderColor: disabled ? C.shade : primary ? C.lime : C.line, opacity: disabled ? 0.72 : 1 }} uiBackground={{ color: disabled ? C.soft : primary ? C.lime : C.soft }} onMouseDown={onClick}>
    {Text(label, '100%', height, l.mobile ? 13 : 17, l, disabled ? C.muted : primary ? C.ink : C.white)}
  </UiEntity>
}

function PlayButton(label: string, width: number, l: Layout, height = 58) {
  const view = getExperimentView()
  const disabled = !view.playReady
  return Button(disabled ? view.playStatus || 'LOADING...' : label, width, startRun, l, true, height, disabled)
}

function Lock(size: number, l: Layout) {
  return <UiEntity uiTransform={{ width: l.p(size), height: l.p(size) }} uiBackground={{ texture: { src: 'assets/images/ui/lock.png' }, textureMode: 'stretch', color: Color4.White() }} />
}

function SkinCard(index: number, l: Layout) {
  const view = getExperimentView(), skin = snakeSkins[index]
  const selected = view.selectedSkin === index, unlocked = isSkinUnlocked(index)
  const previewHeight = l.cardHeight - (l.short ? 58 : 84)
  const sphere = Math.min(l.cardWidth * .56, previewHeight / 2.6)
  const step = (previewHeight - sphere - 10) / 5
  const wave = (part: number) => selected ? Math.sin(view.uiElapsed * 2.5 + part * .7) * sphere * .11 : 0
  const baseX = (l.cardWidth - sphere) / 2
  const headX = baseX + wave(5), headY = 5 + step * 5
  const shade = (c: Color4) => selected ? c : Color4.create(c.r * .52, c.g * .52, c.b * .52, 1)
  return <UiEntity key={`skin-${index}`} uiTransform={{ width: l.p(l.cardWidth), height: l.p(l.cardHeight), flexShrink: 0, margin: { left: l.p(5), right: l.p(5) }, flexDirection: 'column', alignItems: 'center', borderRadius: l.p(18), borderWidth: selected ? 1 : 0, borderColor: C.lime }} uiBackground={{ color: selected ? C.soft : C.clear }} onMouseDown={() => { if (unlocked) { playUiClickSound(); setSkin(index) } }}>
    <UiEntity uiTransform={{ width: l.p(l.cardWidth), height: l.p(previewHeight), flexShrink: 0, positionType: 'relative' }}>
      {[0, 1, 2, 3, 4, 5].map(part => <UiEntity key={`part-${part}`} uiTransform={{ positionType: 'absolute', position: { left: l.p(baseX + wave(part)), top: l.p(5 + step * part) }, width: l.p(sphere), height: l.p(sphere) }} uiBackground={{ texture: { src: ORB }, textureMode: 'stretch', color: shade(part === 5 ? skin.head : part % 2 ? skin.bodyB : skin.bodyA) }} />)}
      {[.2, .61].map((offset, eye) => <UiEntity key={`eye-${eye}`} uiTransform={{ positionType: 'absolute', position: { left: l.p(headX + sphere * offset), top: l.p(headY + sphere * .34) }, width: l.p(sphere * .22), height: l.p(sphere * .25), alignItems: 'center', justifyContent: 'center' }} uiBackground={{ texture: { src: ORB }, textureMode: 'stretch', color: selected ? C.white : C.muted }}>
        <UiEntity uiTransform={{ width: l.p(sphere * .095), height: l.p(sphere * .13) }} uiBackground={{ texture: { src: ORB }, textureMode: 'stretch', color: C.ink }} />
      </UiEntity>)}
      {!unlocked ? <UiEntity uiTransform={{ positionType: 'absolute', position: { left: l.p(l.cardWidth / 2 - 12), top: l.p(headY + sphere * .66) }, width: l.p(24), height: l.p(24) }}>{Lock(24, l)}</UiEntity> : null}
    </UiEntity>
    {Text(skin.name.toUpperCase(), '100%', l.short ? 24 : 36, l.mobile ? 13 : 17, l, selected ? C.lime : C.white)}
    {Text(selected ? 'EQUIPPED' : unlocked ? 'SELECT' : skin.goal ?? 'SPECIAL SKIN', l.cardWidth - 12, l.short ? 34 : 48, l.mobile ? 10 : 11, l, !unlocked ? C.gold : selected ? C.lime : C.muted)}
  </UiEntity>
}

function HatCard(index: number, l: Layout) {
  const hat = snakeHats[index], view = getExperimentView()
  const owned = isHatOwned(index), equipped = view.equippedHat === index
  const previewHeight = l.cardHeight - (l.short ? 58 : 84)
  const artWidth = Math.min(l.cardWidth, previewHeight * 205 / 170)
  return <UiEntity key={`hat-${index}`} uiTransform={{ width: l.p(l.cardWidth), height: l.p(l.cardHeight), flexShrink: 0, margin: { left: l.p(5), right: l.p(5) }, flexDirection: 'column', alignItems: 'center' }} onMouseDown={() => { if (owned) { playUiClickSound(); equipHat(index) } }}>
    <UiEntity uiTransform={{ width: l.p(l.cardWidth), height: l.p(previewHeight), flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
      <UiEntity uiTransform={{ width: l.p(artWidth), height: l.p(artWidth * 170 / 205) }} uiBackground={{ texture: { src: `assets/images/hats/${hat.name}-clean.png` }, textureMode: 'stretch', color: owned ? Color4.White() : C.shade }} />
      {!owned ? <UiEntity uiTransform={{ positionType: 'absolute', position: { top: l.p(previewHeight * .54), left: l.p(l.cardWidth / 2 - 16) }, width: l.p(32), height: l.p(32) }}>{Lock(32, l)}</UiEntity> : null}
    </UiEntity>
    {Text(hat.name.toUpperCase(), '100%', l.short ? 24 : 36, l.mobile ? 13 : 17, l, equipped ? C.lime : C.white)}
    {Text(equipped ? 'EQUIPPED' : owned ? 'SELECT' : 'DISCOVER IN A CHEST', l.cardWidth - 12, l.short ? 34 : 48, l.mobile ? 10 : 11, l, owned ? C.lime : C.gold)}
  </UiEntity>
}

function CollectionMenu(l: Layout) {
  const view = getExperimentView(), count = collection === 'snakes' ? snakeSkins.length : snakeHats.length
  const allItems = Array.from({ length: count }, (_, i) => i)
  const viewportWidth = l.panelWidth - (l.mobile ? 26 : 50)
  const cardLayout = l.mobile ? l : { ...l, cardWidth: Math.min(l.cardWidth, (viewportWidth - 12) / count - 10) }
  const railWidth = l.mobile ? Math.max(viewportWidth - 2, count * (l.cardWidth + 10) + 8) : viewportWidth - 2
  const tabsWidth = Math.min(l.panelWidth - 32, l.mobile ? 624 : 720)
  // Leave a visible 6 px breathing gap between controls; the buttons remain
  // comfortably larger than the 44 px mobile tap target.
  const tabWidth = (tabsWidth - 24) / 4
  const footerWidth = Math.min(l.panelWidth - 32, 648)
  return <UiEntity uiTransform={{ width: l.p(l.panelWidth), height: l.p(l.panelHeight), padding: l.p(l.mobile ? 12 : 24), borderRadius: l.p(28), borderWidth: 1, borderColor: C.line, flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }} uiBackground={{ color: C.panel }}>
    {Logo(l.logoHeight, l)}
    <UiEntity uiTransform={{ width: l.p(tabsWidth), height: l.p(58), flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: { bottom: l.p(l.mobile ? 0 : 17) } }}>
      {Button('SNAKES', tabWidth, () => { collection = 'snakes' }, l, collection === 'snakes', 54)}
      {Button('HATS', tabWidth, () => { collection = 'hats' }, l, collection === 'hats', 54)}
      {Button(`MUSIC ${view.musicEnabled ? 'ON' : 'OFF'}`, tabWidth, toggleMusic, l, false, 54)}
      {Button(`SFX ${view.soundEnabled ? 'ON' : 'OFF'}`, tabWidth, toggleSound, l, false, 54)}
    </UiEntity>
    {/* The scroll track owns 32 px below the cards, plus a separate 12 px
        footer gap. Card labels never sit behind the scrollbar. */}
    <UiEntity key={`carousel-${collection}-${view.menuSession}`} uiTransform={{ width: l.p(viewportWidth), height: l.p(l.cardHeight + 32), margin: { bottom: l.p(12) }, flexShrink: 0, overflow: l.mobile ? 'scroll' : 'hidden' }}>
      <UiEntity uiTransform={{ width: l.p(railWidth), height: l.p(l.cardHeight), flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: { left: l.p(4), right: l.p(4) } }}>
        {allItems.map(index => collection === 'snakes' ? SkinCard(index, cardLayout) : HatCard(index, cardLayout))}
      </UiEntity>
    </UiEntity>
    <UiEntity uiTransform={{ width: l.p(footerWidth), height: l.p(58), flexShrink: 0, flexDirection: 'row', justifyContent: 'space-between' }}>
      {Button('BACK', footerWidth * .21, toggleMenu, l, false)}
      {Button('HOW TO PLAY', footerWidth * .33, openTutorial, l, false)}
      {PlayButton(view.phase === 'gameover' ? 'PLAY AGAIN' : 'PLAY', footerWidth * .42, l)}
    </UiEntity>
    {!l.mobile ? Text('Hold left click + drag, A / D or arrows to steer   |   F, W or Shift to boost', '100%', 42, 12, l, C.muted) : null}
  </UiEntity>
}

function ArenaStatus(l: Layout) {
  const view = getExperimentView(), compact = l.mobile
  const width = compact ? Math.min(204, (l.width - 32) * .48) : 360
  const fill = Math.max(0, Math.min(1, (view.length - 5) / 67))
  const height = compact ? 136 : 208
  return <UiEntity uiTransform={{ positionType: 'absolute', position: { left: l.p(compact ? 12 : 56), top: l.p(compact ? (l.short ? 72 : 100) : 164) }, width: l.p(width), height: l.p(height), padding: l.p(compact ? 10 : 16), borderRadius: l.p(18), borderWidth: 1, borderColor: view.boostingActive ? C.gold : C.line, flexDirection: 'column' }} uiBackground={{ color: C.panel }}>
    <UiEntity uiTransform={{ width: '100%', height: l.p(compact ? 52 : 78), flexDirection: 'row', alignItems: 'center' }}>
      {Text(`${view.length}`, width * .5, compact ? 52 : 78, compact ? 31 : 46, l, C.lime, 'middle-left')}
      {Text('LENGTH', width * .36, 32, compact ? 11 : 14, l, C.muted, 'middle-left')}
    </UiEntity>
    <UiEntity uiTransform={{ width: '100%', height: l.p(compact ? 7 : 11), flexShrink: 0, overflow: 'hidden' }} uiBackground={{ color: C.ink }}>
      <UiEntity uiTransform={{ width: `${Math.max(3, fill * 100)}%`, height: '100%' }} uiBackground={{ texture: { src: 'assets/images/ui/growth.png' }, textureMode: 'stretch', color: Color4.White() }} />
    </UiEntity>
    <UiEntity uiTransform={{ width: '100%', height: l.p(compact ? 42 : 58), margin: { top: l.p(compact ? 8 : 14) }, alignItems: 'center', justifyContent: 'center', borderRadius: l.p(10), borderWidth: 1, borderColor: view.boostingActive ? C.gold : C.line }} uiBackground={{ color: view.boostingActive ? C.gold : C.soft }}>
      {Text(view.boostingActive ? 'BOOST ACTIVE' : view.boostingPossible ? 'BOOST READY' : 'COLLECT TO BOOST', '100%', compact ? 42 : 58, compact ? 10 : 13, l, view.boostingActive ? C.ink : C.muted)}
    </UiEntity>
  </UiEntity>
}

function Leaderboard(l: Layout) {
  const compact = l.mobile, rows = leaderboardView === 'match' ? matchLeaderboard() : globalLeaderboard()
  const width = compact ? Math.min(254, (l.width - 32) * .48) : 370
  const padding = compact ? 8 : 16
  const tabGap = compact ? 6 : 8
  const tabWidth = (width - padding * 2 - tabGap) / 2
  const top = compact ? 90 : 92
  const rowHeight = compact ? 40 : 52
  const headerHeight = 54 + (compact ? 24 : 36)
  const roomForRows = Math.max(rowHeight, l.height - top - (compact ? 86 : 60) - headerHeight - padding * 2)
  const listHeight = Math.min(Math.max(1, rows.length) * rowHeight, roomForRows, rowHeight * (compact ? 5 : 8))
  const perPage = Math.max(1, Math.floor(listHeight / rowHeight))
  const pageCount = Math.max(1, Math.ceil(rows.length / perPage))
  const contentWidth = width - padding * 2 - 4
  const trackHeight = pageCount > 1 ? 32 : 0
  const pageHeight = Math.min(rows.length || 1, perPage) * rowHeight
  return <UiEntity uiTransform={{ positionType: 'absolute', position: { right: l.p(compact ? 4 : 18), top: l.p(top) }, width: l.p(width), height: l.p(headerHeight + pageHeight + trackHeight + padding * 2 + 4), padding: l.p(padding), borderRadius: l.p(18), borderWidth: 1, borderColor: C.line, flexDirection: 'column' }} uiBackground={{ color: C.panel }}>
    <UiEntity uiTransform={{ width: '100%', height: l.p(54), flexShrink: 0, flexDirection: 'row', justifyContent: 'space-between' }}>
      {Button('MATCH', tabWidth, () => { leaderboardView = 'match' }, l, leaderboardView === 'match', 52)}
      {Button('ALL TIME', tabWidth, () => { leaderboardView = 'global' }, l, leaderboardView === 'global', 52)}
    </UiEntity>
    {Text(leaderboardView === 'match' ? `${rows.length} CURRENT PLAYERS` : 'ALL-TIME BEST', '100%', compact ? 24 : 36, compact ? 9 : 11, l, C.muted)}
    <UiEntity key={`standings-${leaderboardView}-${perPage}`} uiTransform={{ width: '100%', height: l.p(pageHeight + trackHeight + 2), flexShrink: 0, overflow: pageCount > 1 ? 'scroll' : 'hidden' }}>
      <UiEntity uiTransform={{ width: l.p(contentWidth * pageCount), height: l.p(pageHeight), flexShrink: 0, flexDirection: 'row' }}>
        {Array.from({ length: pageCount }, (_, page) => <UiEntity key={`standings-page-${page}`} uiTransform={{ width: l.p(contentWidth), height: l.p(pageHeight), flexShrink: 0, flexDirection: 'column' }}>
          {rows.slice(page * perPage, (page + 1) * perPage).map((row, index) => <UiEntity key={`rank-${row.playerId}`} uiTransform={{ width: '100%', height: l.p(rowHeight), flexShrink: 0, flexDirection: 'row', alignItems: 'center' }}>
            {Text(`${page * perPage + index + 1}. ${row.name.slice(0, compact ? 12 : 18)}`, contentWidth * .68, rowHeight, compact ? 11 : 15, l, row.player ? C.lime : C.white, 'middle-left')}
            {Text(`${row.score}`, contentWidth * .32, rowHeight, compact ? 12 : 17, l, C.white, 'middle-right')}
          </UiEntity>)}
          {rows.length === 0 ? Text('Loading scores...', '100%', rowHeight, compact ? 11 : 15, l, C.muted) : null}
        </UiEntity>)}
      </UiEntity>
    </UiEntity>
  </UiEntity>
}

function RestScreen(l: Layout) {
  const view = getExperimentView(), died = view.phase === 'gameover'
  const outerPadding = l.mobile ? 18 : 28
  const width = Math.min(l.width - (l.mobile ? 32 : 48), l.mobile ? 540 : 680)
  const innerWidth = width - outerPadding * 2
  const logoHeight = Math.min(l.mobile ? (l.short ? 76 : 142) : 220, innerWidth * 448 / 1024)
  const height = Math.min(l.height - (l.mobile ? 28 : 40), logoHeight + (l.mobile ? 316 : 350))
  const mainGap = l.mobile ? 10 : 14
  const actionWidth = Math.min(innerWidth, l.mobile ? 420 : 500)
  const secondaryWidth = (actionWidth - mainGap * 2) / 3
  return <UiEntity uiTransform={{ width: l.p(width), height: l.p(height), padding: l.p(outerPadding), borderRadius: l.p(28), borderWidth: 2, borderColor: C.line, flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }} uiBackground={{ color: C.panel }}>
    <UiEntity uiTransform={{ width: '100%', height: l.p(logoHeight), flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
      {Logo(logoHeight, l)}
    </UiEntity>
    <UiEntity uiTransform={{ width: l.p(86), height: l.p(3), flexShrink: 0, margin: { top: l.p(4), bottom: l.p(6) } }} uiBackground={{ color: C.lime }} />
    {Text(died ? 'YOU DIED' : 'GROW. SURVIVE. RULE.', '100%', l.mobile ? 40 : 54, l.mobile ? 27 : 36, l, C.lime)}
    <UiEntity uiTransform={{ width: l.p(Math.min(innerWidth, 280)), height: l.p(34), flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line, margin: { bottom: l.p(12) } }} uiBackground={{ color: C.soft }}>
      {Text(died ? view.resultMessage.replace('You died — ', '') : 'Collect energy. Discover rare hats. Chase the crown.', '100%', 34, l.mobile ? 11 : 13, l, C.white)}
    </UiEntity>
    <UiEntity uiTransform={{ width: l.p(actionWidth), height: l.p(l.mobile ? 52 : 58), flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
      {PlayButton(died ? 'PLAY AGAIN' : 'PLAY', actionWidth, l, l.mobile ? 52 : 58)}
    </UiEntity>
    <UiEntity uiTransform={{ width: l.p(actionWidth), height: l.p(l.mobile ? 48 : 54), margin: { top: l.p(mainGap) }, flexShrink: 0, flexDirection: 'row', justifyContent: 'space-between' }}>
      {Button('SKINS', secondaryWidth, toggleMenu, l, false, l.mobile ? 48 : 54)}
      {Button('HOW TO PLAY', secondaryWidth, openTutorial, l, false, l.mobile ? 48 : 54)}
      {Button('LEAVE GAME', secondaryWidth, leaveGame, l, false, l.mobile ? 48 : 54)}
    </UiEntity>
    <UiEntity uiTransform={{ width: l.p(Math.min(innerWidth, 330)), height: l.p(48), margin: { top: l.p(12) }, flexShrink: 0, flexDirection: 'row', justifyContent: 'space-between' }}>
      {Button(`MUSIC ${view.musicEnabled ? 'ON' : 'OFF'}`, Math.min(innerWidth, 330) * .52 - 6, toggleMusic, l, false, 48)}
      {Button(`SFX ${view.soundEnabled ? 'ON' : 'OFF'}`, Math.min(innerWidth, 330) * .48 - 6, toggleSound, l, false, 48)}
    </UiEntity>
  </UiEntity>
}

function QuickTutorial(l: Layout) {
  const view = getExperimentView()
  const width = Math.min(l.width - 24, l.mobile ? 580 : 760)
  const padding = l.short ? 12 : 24
  const innerWidth = width - padding * 2
  const rowHeight = l.short ? 52 : 74
  const logoHeight = l.short ? 0 : 66
  const paged = l.height < 354
  const height = padding * 2 + logoHeight + 38 + rowHeight * (paged ? 2 : 4) + 12 + 48
  const steps = [
    ['STEER', l.mobile ? 'Use the left joystick to turn your snake.' : 'Hold left click and drag, or use A / D and arrow keys.'],
    ['EAT & GROW', 'All food is safe to eat. Fallen food lasts 45 seconds.'],
    ['BOOST', l.mobile ? 'Hold the arrow button. Boost uses some of your length.' : 'Hold F, W or Shift to boost. Boost uses some of your length.'],
    ['SURVIVE', 'Keep your nose off walls and snake bodies. Cut in front of rivals to defeat them.']
  ]
  return <UiEntity uiTransform={{ width: l.p(width), height: l.p(height), padding: l.p(padding), flexDirection: 'column', alignItems: 'center', borderRadius: l.p(24), borderWidth: 1, borderColor: C.line, overflow: 'hidden' }} uiBackground={{ color: C.panel }}>
    {logoHeight > 0 ? Logo(logoHeight, l) : null}
    {Text(paged ? `HOW TO PLAY  ${tutorialPage + 1} / 2` : 'HOW TO PLAY', '100%', 38, l.mobile ? 23 : 28, l, C.lime)}
    {(paged ? steps.slice(tutorialPage * 2, tutorialPage * 2 + 2) : steps).map(([title, description], i) => <UiEntity key={`tutorial-${tutorialPage}-${i}`} uiTransform={{ width: '100%', height: l.p(rowHeight), flexShrink: 0, flexDirection: 'row', alignItems: 'center' }}>
      {Text(`${i + 1 + (paged ? tutorialPage * 2 : 0)}`, 32, rowHeight, 24, l, C.lime)}
      <UiEntity uiTransform={{ width: l.p(innerWidth - 32), height: l.p(rowHeight), flexDirection: 'column', justifyContent: 'center', flexShrink: 0 }}>
        {Text(title, '100%', l.short ? 18 : 24, l.mobile ? 12 : 16, l, C.lime, 'middle-left')}
        {Text(description, '100%', l.short ? 34 : 44, l.mobile ? 12 : 16, l, C.white, 'middle-left')}
      </UiEntity>
    </UiEntity>)}
    <UiEntity uiTransform={{ width: '100%', height: l.p(48), flexShrink: 0, margin: { top: l.p(12) }, flexDirection: 'row', justifyContent: 'space-between' }}>
      {Button('BACK', innerWidth * .32, () => { if (paged && tutorialPage > 0) tutorialPage--; else tutorialOpen = false }, l, false)}
      {Button(paged && tutorialPage === 0 ? 'NEXT' : view.playReady ? 'GOT IT - PLAY' : view.playStatus || 'LOADING...', innerWidth * .64, () => {
        if (paged && tutorialPage === 0) tutorialPage++
        else if (view.playReady) { tutorialOpen = false; startRun() }
      }, l, true, 48, !view.playReady && !(paged && tutorialPage === 0))}
    </UiEntity>
  </UiEntity>
}

const GameUi = () => {
  const view = getExperimentView(), l = layout()
  const matchLogoHeight = (l.mobile ? 69 : 100) * 1.15
  if (view.menuSession !== lastMenuSession) {
    lastMenuSession = view.menuSession
    collection = 'snakes'
    tutorialOpen = false
  }
  return <UiEntity uiTransform={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
    {view.phase === 'running' ? <UiEntity uiTransform={{ positionType: 'absolute', position: { top: l.p(l.mobile ? 6 : 18) }, width: '100%', height: l.p(matchLogoHeight), alignItems: 'center', justifyContent: 'center' }}>{Logo(matchLogoHeight, l)}</UiEntity> : null}
    {view.phase === 'running' ? ArenaStatus(l) : null}
    {view.phase === 'running' ? Leaderboard(l) : null}
    {view.phase !== 'running' && view.phase !== 'exited' ? (tutorialOpen ? QuickTutorial(l) : view.menuOpen ? CollectionMenu(l) : RestScreen(l)) : null}
  </UiEntity>
}

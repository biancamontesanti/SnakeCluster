# Snake Cluster — Game Design Document

**Version:** 1.0

**Date:** 2026-10-28

**Platform:** Decentraland SDK7 World, desktop and mobile

**World configuration:** `bibi.dcl.eth`
**Status:** Current game specification, based on the implemented project

## 1. Vision

Snake Cluster turns a Decentraland visit into an immediate, shared competition. Players steer colorful snakes through a compact sand arena, collect energy, spend length for speed, outmaneuver rivals, and chase the crown. The game gives strangers and friends a reason to stay together, react to one another, and replay without a host or scheduled event.

The promise is simple: **grow, survive, rule**. A new player should understand the goal within 30 seconds, reach the first food quickly, and be able to start another run immediately after losing.

### Design pillars

1. **Readable, fair danger.** The visible arena edge and snake bodies explain every death. The server decides collisions and rewards.
2. **Instant social rivalry.** Players join a live match, see one another, and compete for a crown that can change hands at any time.
3. **Expressive movement.** Continuous forward motion, deliberate steering, a costly boost, and a smooth chase camera make each run feel skillful.
4. **Short path to replay.** A loading aware Play button, quick tutorial, immediate death feedback, and Play Again keep downtime low.
5. **Personal identity.** Skins, hats, names, and all time best scores give players reasons to return beyond a single run.

## 2. Audience and experience

The primary audience is Decentraland visitors who want a quick multiplayer activity with friends or nearby strangers. The game supports both a first time visitor playing for a few minutes and a repeat player trying to lead the arena or improve a personal best. It is drop in and drop out: a match has no global countdown or forced end, and each snake has its own run.

The intended emotional arc is curiosity → first pickup → visible growth → risk taking → confrontation → dramatic death or crown moment → immediate retry.

## 3. Core loop

1. Enter the World, read How to Play if needed, and choose an available skin or owned hat.
2. Wait for the match and its food to load; press **Play**.
3. Steer a snake that moves forward continuously. Collect energy to grow.
4. Decide when to spend length on boost to escape, intercept, or contest food.
5. Avoid the arena fence and every snake body. Try to make rivals collide with a body.
6. On death, leave collectible energy behind. Review the result and press **Play Again**.

There is no final victory screen. The active goal is to become the longest living snake and hold the crown; the longer term goal is a higher best score and more cosmetics.

## 4. Arena and camera

The scene occupies four Decentraland parcels in a 2×2 layout, approximately 32×32 meters. Snakes move on a horizontal plane over a sand floor. A custom `fence.glb` marks the arena edge. Its collision is enabled for the world, while the multiplayer server applies the lethal snake boundary. The playable snake head center is bounded by coordinates **1.25 to 30.75** on both horizontal axes.

The camera is an elevated, smoothed chase view that follows the local snake and keeps forward movement legible. The normal Decentraland avatar is hidden during snake play so it does not obscure the arena. Leaving snake mode restores the avatar and normal camera in the public strip beside the arena; walking back into the arena reopens the game menu.

## 5. Rules and systems

### Movement and controls

- The snake always moves forward while a run is active; players steer its heading.
- Desktop: hold **left click and drag** to turn, or use **A/D** or **left/right arrows**. Hold **F**, **W**, or **Shift** to boost.
- Mobile: steer with the left joystick and hold the on screen boost control.
- The server integrates steering, movement, speed, and boost cost. Clients send input intent, not positions.
- Base cruise speed is **3.04 m/s**. Boost targets **1.72×** cruise speed before turn speed reduction and smooth acceleration. Strong turns reduce speed to keep corners controllable.
- Mouse steering depends on horizontal drag while left click is held. Incidental pointer movement does not steer.

### Food, growth, and boost

- The server starts and maintains **60** shared normal food items, spread randomly with spacing checks. Consumed normal food moves to another open position.
- Normal food is safe. Each standard item adds one energy and one unit of logical snake length.
- A run begins with **9** length units. The playable minimum is **5**.
- Boost spends one length unit about every **0.55 seconds** while held. Boost stops being available at the minimum length.
- The body visibly grows and shrinks with earned and spent length. Rendering uses a capped entity pool so very long snakes do not exceed scene limits; score logic still uses logical length.

### Collisions and death

- Crossing the arena fence limit, touching your own body, or touching a rival's body ends the run.
- The server tests head travel against body segments between simulation samples, preventing a fast snake from passing through a body unnoticed.
- A **1.75 second** spawn shield prevents unfair immediate body contact deaths; the arena boundary remains lethal.
- Death is a server decision. Client death messages cannot terminate a life or create authoritative remains.
- A dead snake leaves colored energy along its trail. These drops can be eaten by any living snake and expire after **45 seconds**. Their amount is based on the defeated snake's length, with a capped number of pieces.
- A death screen identifies the cause and offers an immediate retry.

### Competition and scoring

- The **crown** belongs to the longest currently living snake. It moves when leadership changes and does not use kill count to choose its wearer.
- The current match leaderboard ranks players by score. The server's score is current living length plus **10 points per kill** for a started run.
- The all time board shows each player's best score, kept by the authoritative server's persistent storage and ordered highest first.
- Rival kills are credited by the server when a snake hits another snake's body. Simultaneous contacts are resolved from the same simulation tick.

### Cosmetics and collection

- Five color skins are available immediately: **Violet, Aqua, Lime, Solar, and Rose**.
- Three special skins unlock from cumulative collected energy: **Royal at 75**, **Inferno at 200**, and **Diamond at 500**.
- Four hats are available through chests: **Pirate, Santa, Sombrero, and Witch**. A chest favors an unowned hat when one remains; owned hats can be equipped from the collection menu.
- The first chest becomes eligible after roughly **75–165 seconds** of active play. Later chests use a **180–360 second** interval. Chests are cosmetic rewards, not competitive power-ups.
- Cosmetic choices change the snake's appearance, not its speed, hit area, or score rules.
- Skin energy and hat ownership are current client session progression; the persistent server record is the all time best score. The design does not promise cross session cosmetic persistence.

## 6. Player flow and interface

| State | Player sees | Exit condition |
| --- | --- | --- |
| Arrival / ready | Arena, logo, Play, Skins, How to Play, Leave Game, sound settings | Player selects Play after readiness completes |
| Loading | Disabled Play with match or food loading text | Server is ready, match loading clears, and all 60 normal food entities are synced |
| Running | Snake and chase camera, length and boost status, match/all time leaderboard | Server confirms a collision or player leaves |
| Game over | Death reason and Play Again | Player starts another run, opens collection/tutorial, or leaves |
| Exited | Normal avatar and camera outside the arena | Player reenters the arena and returns to the menu |

**How to Play** explains steering, eating and growth, the 45 second death drops, boost cost, and collision danger. Desktop and mobile copy uses the appropriate controls. The loading gate applies to Play, Play Again, and the tutorial's final Play action, so a run does not begin before food and match state are available.

The interface should remain readable at desktop and mobile sizes. Important actions use both visual and sound feedback. Music and effects have separate toggles; menu interactions use the Decentraland UI click sound. Eating, death, rival death, and background music have distinct cues.

The core rules must remain understandable with sound off: the HUD shows length and boost availability, the death screen states the collision reason, and the tutorial spells out controls and boost cost. Color is paired with position, shape, labels, or motion wherever it signals a gameplay state. Mobile actions need touch sized targets and layouts that avoid covering the snake's immediate path.

## 7. Multiplayer and fairness

The authoritative server owns the match epoch, food positions and pickups, movement integration, boost spending, snake trails, collision results, death drops, kill awards, and score records. Clients can request movement and food claims; the server validates the sender, run, item revision, and proximity. Old packets and claims cannot revive a dead run or award the same pickup twice.

The server simulates combat at roughly **30 Hz** and sends movement frames at roughly **20 Hz**. Clients buffer confirmed poses, interpolate between them, and use a visual follower and camera smoothing for presentation. Rendering may briefly lag the newest server pose; this is a deliberate visual tradeoff for stability. Presentation never creates a new authoritative movement or collision result. Retained snapshots and synced entities let late joiners see active snakes, food, and ranking state.

Connection loss or a sleeping server is communicated through loading/waking text. Play remains unavailable until server status and the full food set are ready. Existing gameplay authority is not relaxed to hide network delay.

## 8. Visual and audio direction

The arena uses warm sand against the surrounding red landscape and a clear custom fence silhouette. Snakes use bright, contrasting colors, compact overlapping body segments, embedded eyes, and expressive headwear. Energy items are small colorful gems; fallen energy reflects the defeated snake's skin colors. The crown is an unmistakable, temporary status symbol.

The scene should read at a glance from outside the parcel. During play, the head, body path, food, fence, crown, and other snakes are the primary visual hierarchy. Sound reinforces pickups, menu selections, defeat, and rival defeat without being required to understand the rules.

## 9. Success criteria and validation

The game is successful when new players can begin and understand the survival objective within 30 seconds, steer intentionally on desktop and mobile, see why they died, and choose to replay. The following checks turn that intent into observable tests:

| Area | Acceptance check |
| --- | --- |
| Onboarding | A new tester can start, collect food, identify boost cost, and explain wall/body danger after using How to Play. |
| Controls | A tester completes a controlled 60 second run and intentionally boosts at least once on both desktop and mobile. |
| Replay | In a five minute feel test, the creator voluntarily starts at least three runs. This is a design hypothesis, not a claimed measured result. |
| Fairness | A server confirmed wall, self, or rival collision ends exactly one life; forged client positions or deaths do not decide outcomes. |
| Sync | Normal food and late joined snakes appear from retained state; Play is gated until the match and 60 food items are loaded. |
| Remains | Fallen energy can be collected and expires at 45 seconds, including while players are in menus. |
| Presentation | Common packet jitter does not visibly snap the head backward; camera follows the displayed snake. |
| Performance | The arena remains usable at 30 FPS or better on target desktop and mobile devices with several simultaneous snakes. This requires in world device testing. |

Automated regression scripts cover authoritative movement and food, collision/death ordering, network jitter, UI layout, and the 45 second remains lifetime. `npm run build` type checks and bundles the SDK7 scene. The historical prototype notes in `design/01-find-the-fun/` contain partial smoke and owner feedback; their uncompleted feel tests are not represented as passed here.

## 10. Scope and production boundaries

The current product is one persistent arena with individual lives, a live crown, scoreboards, cosmetic choice, chests, audio settings, and desktop/mobile controls. It has no round timer, global match winner, purchasable advantage, or required wallet transaction. It is designed to work with one player and become more interesting as more players join.

Future work should be judged against the five design pillars. Improvements to input feel, mobile readability, in world performance, social discoverability, and progression persistence are valid directions, but they are not part of the rules specified above until implemented and tested.

## 11. Source of truth

- `src/multiplayer-server.ts`, `src/netcode.ts`, and `src/combat.ts`: authoritative movement, food, scoring, and collision rules.
- `src/snake-game.ts` and `src/ui.tsx`: client presentation, controls, cosmetics, audio, and menus.
- `assets/scene/main.composite` and `scene.json`: Creator Hub scene content and World configuration.
- `README.md`: player facing overview and local run instructions.
- `design/decisions.md` and `design/01-find-the-fun/`: design rationale and prototype validation history.

When implementation and this document differ, update the GDD alongside the rule change so players, designers, and developers share one current specification.

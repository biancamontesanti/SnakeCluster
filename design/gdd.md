# Snake Cluster — Game Design Document

**Decentraland Creator Success Program format**

**Updated:** 2026-10-28

**Status:** Playable SDK7 Classic mode; the expansion below is proposed work

| | Snake Cluster |
| --- | --- |
| Public experience title | Snake Cluster. Title clearance has not been documented; the game's custom art and third party asset licenses should be checked before a program submission. |
| Deployment target | Decentraland World `bibi.dcl.eth`, as configured in `scene.json`. A public deployment was not verified for this document. |
| Creator / team | BIBI is named in the scene metadata; repository owner: [biancamontesanti](https://github.com/biancamontesanti/SnakeCluster). Team size and public contact are not recorded in the project. |
| Source | [SnakeCluster repository](https://github.com/biancamontesanti/SnakeCluster) |
| Platform | Desktop and mobile Decentraland, in a four parcel World scene |

---

## 0. TL;DR

| | |
| --- | --- |
| **Player promise** | Become a colorful snake, eat energy to grow, spend length to boost, and outmaneuver other players for the crown. |
| **Primary player** | A Decentraland visitor who wants a quick, readable multiplayer game with friends or strangers, including on a phone. |
| **Current status** | Playable scene with authoritative movement, food, collisions, death drops, cosmetics, a crown, and scoreboards. Automated checks exist; public player count and mobile performance have not been verified here. |
| **Next release goal** | Give the existing arena a stronger 3D look, add permanent rank badges, and prototype one fair tactical weapon while preserving the current Classic rules. |
| **Live outcome after proposed four weeks** | A tested visual upgrade and persistent badges in Classic, plus a separately selectable Arsenal prototype with one weapon. A second themed world and larger arsenal follow only after that prototype proves readable and performant. These are goals, not current features. |

---

## 1. Player Promise

**One line.** Grow a snake, survive the arena, and steal the crown from the longest living rival.

**Familiar comparison.** The immediate collect and grow readability of classic Snake, with a shared live arena where another player's body becomes both danger and opportunity. The future Arsenal mode adds playful, tactical weapons inspired by Worms, adapted to Snake Cluster's continuous movement rather than a turn based round.

**Why this game belongs in Decentraland.** A World can look attractive but still give visitors no reason to interact. Snake Cluster creates a shared activity that works with one person and becomes more dramatic when friends or strangers join. It needs no host, lobby, or scheduled round.

### Design pillars

1. **Readable danger:** the fence and bodies explain death; server decisions are consistent for everyone.
2. **Quick rivalry:** each life begins quickly, the crown is visible, and death feeds new contests over fallen energy.
3. **Expressive control:** steering, timing, and costly boosts create decisions beyond simply collecting food.
4. **Low friction:** desktop and touch can complete the same loop; loading and retries are clearly communicated.
5. **More depth without losing clarity:** lighting, terrain, props, animation, and camera work make the arena feel three dimensional while the movement plane and lethal boundaries stay legible.

---

## 2. First Minutes & How to Play

The times below are **experience targets**, not measured player results. The arena is already a live Decentraland scene when a visitor arrives; Play starts the visitor's snake run.

| Time after control | Intended player experience |
| --- | --- |
| **0–5 seconds** | See the sand arena, custom fence, colorful food, Snake Cluster logo, and a clear Play action. |
| **5–15 seconds** | Choose a skin or open How to Play. If the server or food is still syncing, Play displays loading text and stays unavailable. |
| **15–60 seconds** | Start moving automatically, steer toward the first energy item, hear and see the pickup, and notice length increase in the HUD. |
| **1–3 minutes** | Try boost, see that it spends length, avoid the fence and bodies, and spot the current crown holder on the match board. |
| **3–10 minutes** | Contest a rival's path, collect fallen energy after a death, improve a score, or lose and press Play Again. |
| **Natural stopping point** | After a death, compare the best score and leave the arena through Leave Game. A live rival or personal best gives a reason to return. |

**Player facing How to Play:**

- Steer: hold left click and drag, or use A/D or arrows; on mobile use the left joystick.
- Eat the colorful energy to grow. Fallen energy lasts 45 seconds.
- Hold F, W, or Shift to boost on desktop; use the touch boost control on mobile. Boost spends length.
- Keep your head clear of the fence and all snake bodies, including your own. Cut in front of rivals to defeat them.

---

## 3. Core Loop and Rules

| # | Verb | Input → feedback → change | Why repeat? |
| --- | --- | --- | --- |
| 1 | **Steer** | Drag, press a turn key, or use the joystick → the snake and chase camera turn → a new route opens. | Every food layout and rival path asks for a different line. |
| 2 | **Eat** | Cross a food item → pickup cue and visible growth → length and score rise. | More length brings score, safety margin, and boost fuel. |
| 3 | **Boost** | Hold boost → faster movement and active HUD state → length is spent over time. | Spend length to escape, intercept, or reach valuable fallen food. |
| 4 | **Outmaneuver** | Put a body in a rival's path → server confirmed death and remains → a contested energy trail appears. | Opponents create new tactical situations and can change the crown holder. |
| 5 | **Retry** | Die → reason and Play Again appear → a new life starts when the arena is ready. | Try a better line, pursue the crown, and raise the best score. |

**Loop length:** A pickup and routing decision can happen within seconds. A life has no fixed duration; a satisfying short visit is one or two lives in roughly five minutes. A longer visit can be repeated runs against live rivals. These visit lengths are design targets to verify in playtests.

**Meaningful decision:** Grow safely, or spend length to race and intercept. Since the snake never stops moving, a decision about route and timing is always active.

### Implemented rule sheet

| Rule | Current implementation |
| --- | --- |
| Arena | Four parcels, about 32×32 m. The lethal snake head boundary is x/z 1.25–30.75. The custom `fence.glb` marks that edge. |
| Food | The server creates 60 spaced, randomly placed normal items; consumed items respawn. Standard food adds one energy and one length. |
| Starting length | 9; minimum playable length is 5. |
| Boost | Cruise speed is 3.04 m/s; boost targets 1.72× before turn slowdown. It spends one length about every 0.55 seconds and stops at minimum length. |
| Body contact | Server checks head movement across the space between ticks against own and rival body segments. A 1.75 second spawn shield covers body contact, not the fence. |
| Death remains | Server spawned, snake colored food; collectible by anyone for 45 seconds. |
| Crown | Worn by the longest currently living snake; kill score does not choose the crown holder. |
| Match score | Current living length + 10 points per kill for a started run. |
| All time score | Best score per player is stored by the authoritative server. |

The server owns movement, boost cost, food, pickups, collision results, deaths, kill credit, and records. Clients send control intent and render confirmed poses smoothly. A client cannot teleport its snake, award food, or decide its own death. The visual interpolation can trail the latest server pose slightly to avoid snap back under ordinary packet jitter.

---

## 4. Why Players Come Back

### 4.1 The next day sentence

> Today, a player who enjoyed Snake Cluster can return to beat a durable personal best or reclaim the crown from whoever is online. The proposed next release turns verified score milestones into permanent rank badges, giving the player a visible target that remains earned after a bad run. There is no daily reset, streak, or reminder in the current game.

### 4.2 Progression chain

**Repeatable action → reward → visible status → new decision:** collect food and survive → raise a server stored best score → appear on the all time board → decide whether to protect a long life or risk it to pass a rival.

| Moment | What carries forward now? | What changes for the player? | What can others see? |
| --- | --- | --- | --- |
| **End of first life** | Personal best score is saved by the server. Energy earned during this client session also counts toward special skin thresholds. | Retry with a higher target and choose another unlocked skin. | Current score, name, skin, and crown position in the live match. |
| **End of first visit** | Best score persists. Special skin progress and hats are **session local today**; they should not be described as durable rewards. | The player can return to beat the stored score. | Their best score on the all time board. |
| **Proposed next release** | Add server stored rank badges and cosmetic ownership. | A returning player can pursue the next badge and express that progress in the current World. | A small badge beside the name and on the leaderboard, plus earned cosmetics. |

Current cosmetics: Violet, Aqua, Lime, Solar, and Rose are available immediately. Royal unlocks at 75 cumulative session energy, Inferno at 200, and Diamond at 500. A chest favors an unowned Pirate, Santa, Sombrero, or Witch hat. The first chest is eligible after about 75–165 seconds of active play; later chests use a 180–360 second interval. Cosmetics provide expression, not a speed or hit area advantage. There is no currency or tradable reward.

### 4.3 Two return hooks

| Hook | Trigger | Anticipation | Reminder and fallback | Status |
| --- | --- | --- | --- | --- |
| **Personal best and crown rivalry** | Available whenever the World is open and another run can begin. | Beat yesterday's score or take the live crown. | The all time board and current leader are visible in game; no external reminder exists. | Implemented. |
| **Permanent rank badges** | Proposed: a verified best score first crosses a fixed tier threshold. | The next badge remains attainable across visits, and an earned badge never disappears after a loss. | Next tier progress appears in the menu; earned badges appear beside the snake name and on the leaderboard. No external reminder is required. | Planned for the next release; not implemented. |

**Proposed badge ladder:** Bronze at a best score of 25, Silver at 50, Gold at 100, and Diamond at 200. These are initial balance targets, to be adjusted from playtest score distributions before launch. A badge is granted once from a server verified best score, stored permanently for the current World, and never downgraded. The crown remains a temporary in match title; rank is a fixed, cross visit achievement. Badges give no speed, shield, weapon, or hit area advantage. Cross world rank sharing requires its own verified profile system.

A rotating daily challenge remains a later retention option, not part of the immediate four week scope. Its objectives must use server confirmed events and include solo eligible choices during quiet hours.

---

## 5. Social by Design

| Question | Snake Cluster answer |
| --- | --- |
| **Repeatable social loop** | Player A grows and takes the crown → Player B boosts to intercept → one hits a body → both see the death and the field of fallen energy → nearby players race to collect it → the crown and rankings can change. |
| **Disappearance test** | Without other players, collection, survival, cosmetics, and personal bests still work. Body traps, kill credit, contested remains, and the thrill of taking the crown from a person disappear. |
| **Strangers into a group** | The shared food field and visible crown give strangers a common objective without joining a party or typing. Names above snakes and match rankings make encounters recognizable. |
| **Recognition** | Skin, hat, name, crown, and leaderboard identify rivals. Only best scores persist today; cross visit rival history is not implemented. |
| **Quiet hours and scale** | One player can play immediately. Two or more create direct rivalry. A 5 player playtest is the next practical social and performance threshold; a maximum safe population is not yet measured. |
| **Drop in / drop out** | Players enter individual lives at any time. A late arrival sees retained snakes and food. Leaving ends that player's participation without stopping the arena. |
| **Bystander test** | From outside the fence, a visitor sees colorful snakes weaving between food and a crown moving with the leader. |
| **Shareable moment** | A small snake boosts across a larger rival's path; the rival crashes, its body becomes food, and the crown changes heads. |
| **Bring a friend** | A friend can enter the same World, recognize your snake by name and color, and challenge you immediately rather than wait for a round start. |

---

## 6. Mobile First

| Core verb | Touch implementation |
| --- | --- |
| Steer | Left joystick turns the snake while it continues forward. |
| Eat | Move the head through food; no separate tap is needed. |
| Boost | Hold the on screen boost control. |
| Compete | Use the same movement, collision, crown, and food rules as desktop. |
| Retry | Tap Play Again after the server confirms death and the match is ready. |

**UI plan.** Keep the snake and the path immediately ahead visible. Use a compact length/boost HUD, a separate match/all time leaderboard, large touch actions, and short tutorial copy. The Play button explains server and food loading rather than accepting an early start. Music and sound effects can be toggled independently. Core rules remain understandable with sound off because length, boost state, and death reason are visible.

**Desktop controls.** Hold left click and drag, or A/D or left/right arrows to steer. Hold F, W, or Shift to boost. The SDK's portable secondary action is used where available; a distinct right click promise is not made because it is not a reliable cross platform input in the current implementation.

**Performance target.** At least 30 FPS on a representative mid range mobile device with five visible snakes, with readable controls and no repeated backward snap. Desktop and mobile device measurements at this population are pending. The renderer caps local and remote body entities; the game still uses logical length for rules and score.

---

## 7. World, Look & Audio

**World.** Snake Cluster is an always open sand arena inside a four parcel Decentraland World. The fence gives the space a clear boundary; the surrounding red landscape frames the play area. The ordinary avatar is hidden during snake play, then restored when the player leaves game mode. This existing arena becomes the **Dune** theme if additional worlds are built.

**Visual direction.** Bright snakes and small colorful energy items contrast against warm sand. Compact overlapping segments read as one body; embedded eyes keep the head expressive. Fallen energy inherits the defeated snake's colors. The moving crown makes leadership visible without opening a board. Signature shot: several snakes crossing the sand, one crowned, with fresh energy scattered where a rival fell.

**Next visual pass.** Give the snake a more continuous, rounded 3D body, a head with greater volume and facial expression, grounded shadows, subtle body undulation, and clearer turns. Add layered arena props, material variation, and depth cues so the camera reads the world as a place rather than a flat board. Food, weapons, hazards, bodies, and the lethal fence need distinct silhouettes from the chase camera and on a phone. Art must match the server's collision shapes; decorative height must not imply a climbable route or a safe path through the fence.

**Audio.** Music, pickup, death, enemy death, and menu feedback are distinct. Menu buttons use the Decentraland UI click sound. Music and effects have separate toggles. Audio confirms actions but does not carry exclusive gameplay information.

---

## 8. Audience & Comparables

**Primary player and arrival.** A Decentraland visitor arriving from the World directory, a friend link, or an in world encounter, looking for a five minute game that can expand into a longer rivalry. The first acquisition channel is the existing World and shareable repository/community presence; no event schedule or marketing campaign is recorded as already running.

**Deliberately not for.** Players seeking a long scripted quest, a tradable reward economy, or a turn based game. Snake Cluster is continuous movement and repeatable spatial competition.

| | Classic Snake | Shared arena snake games such as Slither.io | Snake Cluster choice |
| --- | --- | --- | --- |
| Useful reference | Simple rule: collect and grow while avoiding your body. | Other players turn movement and body placement into live competition. | Preserve instant readability and add Decentraland identity and presence. |
| Poor fit to copy | A fixed grid and solitary play would underuse a shared 3D World. | Browser specific input and scale do not map directly to Decentraland mobile or scene budgets. | Keep a compact four parcel arena, one clear camera, and server owned fairness. |
| Distinctive choice | — | — | Boost consumes length; the living length crown and 45 second remains make each death a new social contest. |

The table is a design comparison, not a claim of user research or performance data about those games. The tactical weapon reference is Worms' playful variety and readable anticipation; Snake Cluster's Arsenal mode will use original weapon designs and retain real time snake movement.

---

## 9. Expansion Vision and Design Rules

These features are **proposed**, not implemented. Build them in layers so the existing quick, fair Snake Cluster loop remains a dependable baseline.

### 9.1 Stronger 3D presentation

The first pass changes how the game looks and feels, not its collision rules: a volumetric snake head, a continuous looking body, smoother animation, grounded shadows, richer sand and landscape materials, and a camera with more depth. Test the result from the actual play camera on desktop and mobile. A cosmetic model must never hide the head, food, weapon telegraph, or fence. Keep snake movement on the current horizontal plane until a separate vertical movement prototype proves it is readable and fair.

**Acceptance:** Five snakes remain visually distinguishable; body and fence contacts look consistent with server deaths; the target mobile device holds at least 30 FPS; existing movement, collision, and network regression checks still pass.

### 9.2 Classic and Arsenal modes

**Classic** keeps today's rules: food, boost, lethal bodies and fence, crown, and current scoring. **Arsenal** is an optional, separate real time mode that adds tactical weapon pickups. A player chooses the mode before Play. Arsenal gets its own match leaderboard and best score so weapon use cannot distort Classic rankings. Weapons never appear in Classic.

Arsenal borrows the *playful tactical choice* of Worms, not its turn structure or named weapons. Every weapon has a clear pickup, one action to use it, a visible warning or travel path, an effect resolved by the authoritative server, a short duration, and a counterplay window. A player may hold **one weapon charge** at a time. The first prototype is a **Front Rocket**: it fires along the snake's current heading, travels visibly, and on a confirmed hit removes a small fixed amount of rival length down to the normal minimum of five. It does not directly kill, change a rival's heading, destroy the arena fence, or bypass the body's normal lethal collision rule. Initial tuning target: a 1.5 second travel window and a cost of three length units on hit; tune after player tests.

After the rocket is readable and fair, test a **Trail Mine** (placed behind the snake, delayed arming, visible marker, limited lifetime) and a **Shield** (absorbs one weapon hit, never a fence or body collision). Only add each to the live mode after testing its counterplay and mobile controls. Terrain destruction, explosive chain reactions, and knockback are later experiments because they can obscure the lethal boundary and add heavy sync cost.

**Input rule:** one dedicated weapon action on desktop and one large touch button on mobile, separate from steering and boost. No aim menu should interrupt continuous movement. **Fairness rule:** the server owns pickup spawning, charge inventory, firing, projectile positions, hit results, and length changes; clients only request use and render effects. Weapon effects are earned in the arena, never purchased as competitive advantages.

**Acceptance:** At least three new testers can identify the rocket's warning and effect without an oral explanation; a mobile player can steer, boost, and fire without losing control; simulated packet loss does not duplicate a weapon or hit; five player performance remains within the mobile target.

### 9.3 More themed worlds

Treat each world as a recognizable arena with the same movement, food, death, and authority rules. The current sand arena is **Dune**. Prototype one contrasting second arena, **Crystal Cavern**, with cool light, layered rock forms, glowing food, and the same clear lethal perimeter. A third **Verdant Ruins** theme can follow only if the second arena attracts repeat play. These are working art directions, not committed World names or deployments.

The first new arena changes scenery and routes of attention, not snake physics or competitive rules. A later world may add one server owned environmental hazard if it is legible, avoidable, and tested on mobile. Whether arenas are separate Decentraland World deployments or linked scenes must be decided when available World names, navigation, and cross world profile storage are known. The GDD does not assume that a profile automatically transfers between deployments.

**Acceptance:** A player can identify the arena and fence in two seconds, find food quickly, and understand a death in either theme. Performance and collision tests pass separately for each arena. If worlds are separate deployments, badge and cosmetic persistence must be verified across them before advertising a shared profile.

### 9.4 More cosmetics and fixed rank badges

Grow the collection through distinctive skins, eyes, hats, trails, and death effects. Each item needs a readable silhouette or effect at the chase camera distance, a clear unlock source, and no change to collision size, speed, food value, or weapon strength. Persist ownership on the server before expanding beyond the current session local hats and special skins. Do not use a cosmetic that looks like a live weapon warning or a crown.

Rank badges are a separate, permanent status layer. The proposed Bronze / Silver / Gold / Diamond thresholds in Section 4 are earned from server verified best scores, remain fixed after a loss, and display beside player names and on leaderboards. The crown still changes with the longest living snake. In Arsenal, a separate badge track may be added later; Classic badges must not be earned from weapon assisted scores.

### 9.5 Order of implementation

| Stage | Deliverable | Gate before moving on |
| --- | --- | --- |
| **1 — 3D foundation** | New snake look, depth, lighting, camera tuning, and collision aligned visuals in Dune. | Mobile readability and 30 FPS at five snakes; no regression in movement or death. |
| **2 — Identity** | Server stored cosmetic ownership and fixed Classic rank badges. | Earn, reconnect, and return after server restart without losing ownership or rank. |
| **3 — Arsenal vertical slice** | Mode selection, separate scores, one Front Rocket, desktop/touch action, and server validation. | New player comprehension, counterplay, no duplicate hits, and five player performance. |
| **4 — New world** | Crystal Cavern art and navigation prototype using proven rules. | Food, fence, camera, and profile behavior pass in both arenas. |
| **5 — Content expansion** | Additional cosmetics, then Mine and Shield, then another world or a daily challenge based on retention evidence. | Each addition must improve repeat play without undermining clarity or fairness. |

---

## 10. Proposed Four Week Plan

The current playable game already contains the Classic loop. This is the **first stage of the expansion**, not a promise that every world and weapon will ship in four weeks.

| Week | Playable outcome and evidence |
| --- | --- |
| **1 — Visual prototype and baseline** | Test a more volumetric snake and 3D environment depth in Dune. Record the current mobile frame rate, first minute comprehension, and collision readability with one, two, and five players. |
| **2 — 3D pass and rank foundations** | Finish the first visual pass under scene limits. Add server stored best score badge awards with provisional fixed thresholds; verify reconnection and server restart persistence. |
| **3 — Arsenal prototype** | Add an opt in mode and one Front Rocket with a single touch/keyboard action. Keep Classic untouched, separate its scores, and test server validation, telegraph timing, and counterplay. |
| **4 — Playtest and release decision** | Run desktop and mobile five player tests. Ship the 3D pass and badges if they meet acceptance checks; keep Arsenal experimental until its controls, fairness, and performance pass. Define Crystal Cavern's art brief from what players found readable. |

**What keeps it changing after launch.** Live opponents, food, and remains already vary each visit. Permanent ranks and cosmetics add longer goals; Arsenal adds new decisions; themed worlds refresh the setting. A daily challenge is a later option if retention testing shows that these reasons are not enough.

**Outside this four week release:** a second fully shipped world, multiple live weapons, destructible terrain, paid power upgrades, tradable rewards, and global round timers. The new world and extra powers have named gates in Section 9 rather than being abandoned.

**Top risk and fallback.** Extra art and weapon effects could make mobile play slower and collisions harder to read. Measure from the play camera at five players. If the target device cannot meet 30 FPS or new players misread danger, reduce props, particles, materials, and rendered body detail before changing authoritative rules. If the weapon prototype fails, ship the 3D and badge work while Classic remains the main game.

---

## 11. Validation and Source of Truth

| Claim to prove | Pass condition | Current evidence |
| --- | --- | --- |
| First minute clarity | New tester starts, collects food, understands boost cost and death cause without an oral explanation. | How to Play and loading UI exist; an unprompted study has not been recorded. |
| Cross platform control | One controlled 60 second run with an intentional boost on desktop **and** mobile. | Desktop mechanical smoke is documented in `design/01-find-the-fun/`; creator feel pass and mobile pass remain unreported. |
| Replay appeal | At least three voluntarily started runs in a five minute creator test. | Earlier prototype hypothesis was deferred; no result should be claimed. |
| Multiplayer fairness | Server confirmed wall, self, and rival contacts end exactly one life; false client death/position reports do not decide outcomes. | Automated server and gameplay regression checks cover these cases. |
| Return appeal | Observe players returning the next day and identify whether score, rivals, or the proposed daily objective brought them back. | Not measured. |
| Performance | 30 FPS or better with five snakes on the target mobile device, with readable steering and no repeated backward snap. | Network jitter tests exist; in world device measurement is pending. |
| 3D upgrade | The new snake and arena read as three dimensional, but visible contacts still match the server's hit rules. | Proposed; compare play camera footage and collision outcomes in desktop/mobile tests. |
| Rank badges | Server awards a fixed tier once, keeps it after death, reconnection, and restart, and never grants gameplay power. | Proposed; requires persistent profile tests. |
| Arsenal | Front Rocket has one server confirmed charge and hit, visible counterplay, separate ranking, and usable mobile input. | Proposed; requires a multiplayer prototype and packet loss tests. |
| New world | Crystal Cavern preserves food, fence, camera, performance, and profile rules. | Proposed; verify after the first world prototype. |

Implementation references: `src/multiplayer-server.ts`, `src/netcode.ts`, and `src/combat.ts` define authoritative rules; `src/snake-game.ts` and `src/ui.tsx` define presentation and controls; `scene.json` and `assets/scene/main.composite` define the World and static scene. `README.md` provides player instructions. `design/decisions.md` and `design/01-find-the-fun/` retain the earlier rationale and test history.

When a rule changes in code, update this document and the player facing How to Play copy together.

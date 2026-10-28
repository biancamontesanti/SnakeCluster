# Snake Cluster — Game Design Document

**Decentraland Creator Success Program format**

**Updated:** 2026-10-28

**Status:** Playable SDK7 project; the four week plan below is proposed work

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
| **Next release goal** | Make the first minutes and cross platform controls consistently clear, prove multiplayer performance, and add a concrete next day return reason without changing the fair core rules. |
| **Live outcome after proposed four weeks** | A reliable always open arena with a tested mobile experience, durable cosmetic progress, and one daily challenge that gives returning players a fresh target. These are goals, not current features. |

---

## 1. Player Promise

**One line.** Grow a snake, survive the arena, and steal the crown from the longest living rival.

**Familiar comparison.** The immediate collect and grow readability of classic Snake, with a shared live arena where another player's body becomes both danger and opportunity. Snake Cluster adds Decentraland presence, visible identity, a boost that spends length, and a crown that changes hands during play.

**Why this game belongs in Decentraland.** A World can look attractive but still give visitors no reason to interact. Snake Cluster creates a shared activity that works with one person and becomes more dramatic when friends or strangers join. It needs no host, lobby, or scheduled round.

### Design pillars

1. **Readable danger:** the fence and bodies explain death; server decisions are consistent for everyone.
2. **Quick rivalry:** each life begins quickly, the crown is visible, and death feeds new contests over fallen energy.
3. **Expressive control:** steering, timing, and costly boosts create decisions beyond simply collecting food.
4. **Low friction:** desktop and touch can complete the same loop; loading and retries are clearly communicated.

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

> Today, a player who enjoyed Snake Cluster can return to beat a durable personal best or reclaim the crown from whoever is online. The project has **no daily reset, streak, or reminder yet**. The proposed next release adds one rotating daily challenge so the next day's goal is explicit.

### 4.2 Progression chain

**Repeatable action → reward → visible status → new decision:** collect food and survive → raise a server stored best score → appear on the all time board → decide whether to protect a long life or risk it to pass a rival.

| Moment | What carries forward now? | What changes for the player? | What can others see? |
| --- | --- | --- | --- |
| **End of first life** | Personal best score is saved by the server. Energy earned during this client session also counts toward special skin thresholds. | Retry with a higher target and choose another unlocked skin. | Current score, name, skin, and crown position in the live match. |
| **End of first visit** | Best score persists. Special skin progress and hats are **session local today**; they should not be described as durable rewards. | The player can return to beat the stored score. | Their best score on the all time board. |
| **Proposed next release** | Add server stored cosmetic unlocks and one daily challenge completion record. | A returning player can pursue a new target while still competing under equal gameplay rules. | An earned cosmetic and challenge completion marker, if implemented. |

Current cosmetics: Violet, Aqua, Lime, Solar, and Rose are available immediately. Royal unlocks at 75 cumulative session energy, Inferno at 200, and Diamond at 500. A chest favors an unowned Pirate, Santa, Sombrero, or Witch hat. The first chest is eligible after about 75–165 seconds of active play; later chests use a 180–360 second interval. Cosmetics provide expression, not a speed or hit area advantage. There is no currency or tradable reward.

### 4.3 Two return hooks

| Hook | Trigger | Anticipation | Reminder and fallback | Status |
| --- | --- | --- | --- | --- |
| **Personal best and crown rivalry** | Available whenever the World is open and another run can begin. | Beat yesterday's score or take the live crown. | The all time board and current leader are visible in game; no external reminder exists. | Implemented. |
| **Daily Crown Challenge** | Proposed: one server selected objective rotates at 00:00 UTC, such as collect 20 energy in one life, survive 3 minutes, or earn one rival kill. | A named objective changes the next visit without changing the arena or giving a power advantage. | Proposed challenge card in the entry and death menus; if no social reminder is posted, the card still appears on arrival. | Planned for the next release; not implemented. |

The challenge must use server confirmed events and be equally available to a solo player when its objective permits it. Rival kill objectives should be skipped during quiet hours or selected only when enough players are present. No streak punishment is proposed. A missed day simply brings a new objective.

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

**World.** Snake Cluster is an always open sand arena inside a four parcel Decentraland World. The fence gives the space a clear boundary; the surrounding red landscape frames the play area. The ordinary avatar is hidden during snake play, then restored when the player leaves game mode.

**Visual direction.** Bright snakes and small colorful energy items contrast against warm sand. Compact overlapping segments read as one body; embedded eyes keep the head expressive. Fallen energy inherits the defeated snake's colors. The moving crown makes leadership visible without opening a board. Signature shot: several snakes crossing the sand, one crowned, with fresh energy scattered where a rival fell.

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

The table is a design comparison, not a claim of user research or performance data about those games.

---

## 9. Proposed Four Week Plan

The current playable game already contains the core loop. This is a **next release plan**, not a claim that these features or tests are complete.

| Week | Playable outcome and evidence |
| --- | --- |
| **1 — Baseline** | Run an unprompted first minute test with at least three new visitors; record time to Play, first pickup, first boost, first death, and whether the death cause is understood. Reproduce current desktop and mobile build checks. |
| **2 — Fairness and social test** | Test at one, two, and five simultaneous players. Verify crown handoff, simultaneous collisions, 45 second remains, late join visibility, server recovery, and no duplicate kill awards. Fix any observed rule mismatch. |
| **3 — Durable return hook** | Store cosmetic unlocks and daily challenge completion on the server, add the daily challenge card, and test the UTC rotation and solo eligible objective selection. Do not add competitive stat bonuses. |
| **4 — Mobile and release pass** | Test touch controls and HUD on a representative mid range phone with five snakes; reach the 30 FPS target, run a public World smoke test, document final controls, and verify that the first minute and replay tests pass. |

**What keeps it changing after launch.** Live opponents and changing food/remains already create variation. A server selected daily objective would add a named next day reason without a new map. If the daily feature slips, the existing score and crown loop remains playable; the GDD and UI must not claim a daily challenge until it ships.

**What is outside this release.** A second arena, paid power upgrades, tradable rewards, global round timers, and a complex quest system. Cosmetics remain visual only.

**Top risk and fallback.** The biggest product risk is that high latency or crowded scenes make snake steering and collisions feel unfair even when the server is correct. First measure five player desktop/mobile sessions and inspect confirmed pose presentation. If a device cannot meet the target, reduce visual entity load and adjust presentation buffering while preserving server decisions; do not give clients authority over movement or death.

---

## 10. Validation and Source of Truth

| Claim to prove | Pass condition | Current evidence |
| --- | --- | --- |
| First minute clarity | New tester starts, collects food, understands boost cost and death cause without an oral explanation. | How to Play and loading UI exist; an unprompted study has not been recorded. |
| Cross platform control | One controlled 60 second run with an intentional boost on desktop **and** mobile. | Desktop mechanical smoke is documented in `design/01-find-the-fun/`; creator feel pass and mobile pass remain unreported. |
| Replay appeal | At least three voluntarily started runs in a five minute creator test. | Earlier prototype hypothesis was deferred; no result should be claimed. |
| Multiplayer fairness | Server confirmed wall, self, and rival contacts end exactly one life; false client death/position reports do not decide outcomes. | Automated server and gameplay regression checks cover these cases. |
| Return appeal | Observe players returning the next day and identify whether score, rivals, or the proposed daily objective brought them back. | Not measured. |
| Performance | 30 FPS or better with five snakes on the target mobile device, with readable steering and no repeated backward snap. | Network jitter tests exist; in world device measurement is pending. |

Implementation references: `src/multiplayer-server.ts`, `src/netcode.ts`, and `src/combat.ts` define authoritative rules; `src/snake-game.ts` and `src/ui.tsx` define presentation and controls; `scene.json` and `assets/scene/main.composite` define the World and static scene. `README.md` provides player instructions. `design/decisions.md` and `design/01-find-the-fun/` retain the earlier rationale and test history.

When a rule changes in code, update this document and the player facing How to Play copy together.

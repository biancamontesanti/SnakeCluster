# Snake Cluster — Game Design Document

**Decentraland Creator Success Program format**

**Updated:** 2026-10-28

**Status:** Playable SDK7 project; future versions below are design goals

| | Snake Cluster |
| --- | --- |
| Public experience title | Snake Cluster — an original game created by BIBI. |
| Deployment target | Decentraland World `bibi.dcl.eth`, as configured in `scene.json`. A public deployment was not verified for this document. |
| Creator / team | BIBI — solo creator (1 person). GitHub: [biancamontesanti](https://github.com/biancamontesanti/SnakeCluster). |
| Source | [SnakeCluster repository](https://github.com/biancamontesanti/SnakeCluster) |
| Platform | Desktop and mobile Decentraland, in a four parcel World scene |

---

## 0. TL;DR

| | |
| --- | --- |
| **Player promise** | Become a colorful snake, eat energy to grow, spend length to boost, and outmaneuver other players for the crown. |
| **Primary player** | A Decentraland visitor who wants a quick, readable multiplayer game with friends or strangers, including on a phone. |
| **Current status** | Playable scene with authoritative movement, food, collisions, death drops, cosmetics, a crown, and scoreboards. Automated checks exist; public player count and mobile performance have not been verified here. |
| **Next release goal** | Expand the Dune arena substantially and make its terrain, snakes, lighting, and camera feel more three dimensional while keeping the current game fair and readable. |
| **Live outcome after proposed four weeks** | A larger Dune arena with a tested 3D visual pass on desktop and mobile. Collectable powers and temporary invincibility are the following version, not current features. |

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

> Today, a player who enjoyed Snake Cluster can return to beat a durable personal best or reclaim the crown from whoever is online. The project has **no daily reset, streak, or reminder yet**. Later versions can add new arena experiences and powers as reasons to return.

### 4.2 Progression chain

**Repeatable action → reward → visible status → new decision:** collect food and survive → raise a server stored best score → appear on the all time board → decide whether to protect a long life or risk it to pass a rival.

| Moment | What carries forward now? | What changes for the player? | What can others see? |
| --- | --- | --- | --- |
| **End of first life** | Personal best score is saved by the server. Energy earned during this client session also counts toward special skin thresholds. | Retry with a higher target and choose another unlocked skin. | Current score, name, skin, and crown position in the live match. |
| **End of first visit** | Best score persists. Special skin progress and hats are **session local today**; they should not be described as durable rewards. | The player can return to beat the stored score. | Their best score on the all time board. |
| **Future versions** | A larger 3D Dune arena comes first, followed by collectable powers. Persistent cosmetic unlocks and daily challenges remain later possibilities. | A returning player discovers a richer arena and gains new tactical choices without losing the original snake loop. | Powers are visible in play; any future cosmetic progress must be stored before it is described as permanent. |

Current cosmetics: Violet, Aqua, Lime, Solar, and Rose are available immediately. Royal unlocks at 75 cumulative session energy, Inferno at 200, and Diamond at 500. A chest favors an unowned Pirate, Santa, Sombrero, or Witch hat. The first chest is eligible after about 75–165 seconds of active play; later chests use a 180–360 second interval. Cosmetics provide expression, not a speed or hit area advantage. There is no currency or tradable reward.

### 4.3 Two return hooks

| Hook | Trigger | Anticipation | Reminder and fallback | Status |
| --- | --- | --- | --- | --- |
| **Personal best and crown rivalry** | Available whenever the World is open and another run can begin. | Beat yesterday's score or take the live crown. | The all time board and current leader are visible in game; no external reminder exists. | Implemented. |
| **New Dune experience and powers** | Proposed: a substantially larger 3D Dune arena, then power capsules that players collect and release at a chosen moment. | New routes, more room for rivals, and a tactical decision about when to use a held power. | The arena and power icon are visible on arrival; no external reminder is required. | Planned across future versions; not implemented. |

Future powers must be available through play, have clear visual feedback, and use server confirmed pickup and activation. A rotating daily challenge can be considered after the larger arena and powers are working; it is not part of the next version.

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

**World.** Snake Cluster is an always open sand arena inside a four parcel Decentraland World. The fence gives the space a clear boundary; the surrounding red landscape frames the play area. The ordinary avatar is hidden during snake play, then restored when the player leaves game mode. The next version expands this arena substantially; its exact parcel layout is a future implementation decision, not a change to the current scene.

**Visual direction.** Bright snakes and small colorful energy items contrast against warm sand. Compact overlapping segments read as one body; embedded eyes keep the head expressive. Fallen energy inherits the defeated snake's colors. The moving crown makes leadership visible without opening a board. Signature shot: several snakes crossing the sand, one crowned, with fresh energy scattered where a rival fell.

**Next visual direction.** Make the arena feel like a larger 3D dune landscape: sculpted sand forms, layered rocks and vegetation, stronger depth from the chase camera, grounded shadows, and a more volumetric snake body. The playable route and lethal fence must stay easy to read. Decorative dunes can create depth without silently changing the snake's horizontal movement or server collision rules.

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

## 9. Next Versions

These are **planned design steps**, not features already in the playable build. The current 32×32 m arena and its rules remain the baseline for comparison.

| Version | Main change | Player payoff | Release gate |
| --- | --- | --- | --- |
| **v1.1 — Dune XL** | Make the arena substantially larger and give it a stronger 3D dune identity. A 64×64 m play area is the first size target, subject to scene layout and performance validation. | More room for long snakes, escapes, interceptions, and exploration without losing sight of food or the fence. | Desktop/mobile readability, food availability, spawn fairness, authoritative boundary tests, and acceptable frame rate with several snakes. |
| **v1.2 — Power Capsules** | Add collectible power capsules that a snake can carry and release or activate with a dedicated action. Start with temporary invincibility. | Players choose *when* to spend a rare power, creating tactical moments beyond boost. | Server verified pickup/use, visible activation, balanced duration and spawn rate, and usable controls on desktop and mobile. |
| **v1.3 — Power Variety** | Add more powers only after the first one proves fun and fair. Candidate powers include a food magnet or a short trail effect; each needs its own counterplay and visual language. | More different choices across repeated runs. | No power makes the original movement, food, crown, or body collision strategy irrelevant. |

### v1.1 — a larger 3D Dune arena

Grow the space first, then tune food density and spawn distribution for the new size; simply multiplying the current 60 food entities by four may exceed the scene's performance budget. Build distinctive dune shapes, rock formations, vegetation, ground textures, shadows, and a camera composition with more depth. Keep the path immediately ahead, snake bodies, food, and arena limit clearly visible. The floor can look sculpted while snake movement stays on the current horizontal plane until vertical gameplay is separately designed and tested.

The arena fence, invisible avatar boundary, client presentation, and server lethal bounds must all be recalibrated together. Choose the final parcel layout before implementation; changing parcels will also affect scene coordinates and Creator Hub content. A larger arena succeeds only if a new player still finds food quickly and other players remain visible enough for rivalry.

### v1.2 — collect, carry, and release powers

Power capsules appear in the arena as a distinct collectible, separate from normal food. A snake can hold **one charge** at a time. The HUD shows the held power and its ready state; a dedicated button releases or activates it. The server decides capsule spawn, pickup ownership, use, duration, and expiration. Clients show the effect immediately after confirmation, without deciding the competitive result themselves. Powers are found through play, not purchased for an advantage.

The first power is **temporary invincibility**. Proposed starting balance: three seconds of protection from collisions with snake bodies, a clear glow and countdown, no stacking, and a cooldown before another capsule can be used. The arena fence remains lethal so the power cannot be used to leave the play area. This is a prototype rule and must be tuned with multiplayer tests; the game must show exactly when protection begins and ends.

Add the power action to How to Play when this version ships. On mobile, its button must not overlap steering or boost. On desktop, it needs a reliable key or button distinct from those controls. Until the power system passes tests, the current game has no invincibility mechanic.

### Proposed four week path to v1.1

| Week | Playable outcome and evidence |
| --- | --- |
| **1 — Size and route prototype** | Greybox the larger arena, test spawn positions, food reachability, fence visibility, and five player density on desktop and mobile. |
| **2 — Dune art pass** | Add sculpted dunes, layered props, materials, shadows, and a more dimensional snake look while preserving readable hit shapes. |
| **3 — Rule and performance alignment** | Update server bounds, avatar colliders, food distribution, camera range, and client visuals together; run collision and late join regression checks. |
| **4 — Player validation** | Run unprompted first minute tests and mobile five player performance tests. Ship v1.1 only if controls, fairness, food access, and the 30 FPS target pass. |

After v1.1, prototype v1.2 powers in the expanded arena. v1.3 depends on evidence from that first power rather than a fixed release date. Daily challenges and permanent cosmetic storage remain separate later ideas. No paid power upgrades, tradable rewards, or global round timer are planned for these versions.

**Top risk and fallback.** A bigger, more detailed arena may reduce mobile performance or make encounters too rare. Measure from the play camera at five players; if either problem appears, reduce decorative detail, tighten the useful play area, and tune food/spawn zones before adding powers. Keep the server authoritative for every boundary, pickup, and power result.

---

## 10. Validation and Source of Truth

| Claim to prove | Pass condition | Current evidence |
| --- | --- | --- |
| First minute clarity | New tester starts, collects food, understands boost cost and death cause without an oral explanation. | How to Play and loading UI exist; an unprompted study has not been recorded. |
| Cross platform control | One controlled 60 second run with an intentional boost on desktop **and** mobile. | Desktop mechanical smoke is documented in `design/01-find-the-fun/`; creator feel pass and mobile pass remain unreported. |
| Replay appeal | At least three voluntarily started runs in a five minute creator test. | Earlier prototype hypothesis was deferred; no result should be claimed. |
| Multiplayer fairness | Server confirmed wall, self, and rival contacts end exactly one life; false client death/position reports do not decide outcomes. | Automated server and gameplay regression checks cover these cases. |
| Return appeal | Observe players returning the next day and identify whether score, rivals, the larger Dune arena, or powers brought them back. | Not measured; arena and powers are future versions. |
| Performance | 30 FPS or better with five snakes on the target mobile device, with readable steering and no repeated backward snap. | Network jitter tests exist; in world device measurement is pending. |
| Dune XL | A larger arena still has readable boundaries, reachable food, fair spawns, and visible rivals on desktop and mobile. | Proposed for v1.1; requires a new parcel/layout and in world tests. |
| Invincibility | The server grants one collected charge, applies and ends body collision protection at the same time for all players, and still kills at the fence. | Proposed for v1.2; not implemented. |

Implementation references: `src/multiplayer-server.ts`, `src/netcode.ts`, and `src/combat.ts` define authoritative rules; `src/snake-game.ts` and `src/ui.tsx` define presentation and controls; `scene.json` and `assets/scene/main.composite` define the World and static scene. `README.md` provides player instructions. `design/decisions.md` and `design/01-find-the-fun/` retain the earlier rationale and test history.

When a rule changes in code, update this document and the player facing How to Play copy together.

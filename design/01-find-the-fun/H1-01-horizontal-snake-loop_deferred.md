# H1-01 · Horizontal snake loop

- **IF/THEN:** IF horizontal steering, collecting, growth, and collision form a readable loop in a 3D arena, THEN the owner voluntarily starts at least three runs during a five-minute self-test.
- **Source section:** — (backfill via dcl-gdd)
- **Cheapest killing test:** greybox in desktop Explorer, owner self-test, 5 min
- **Key metric:** At least three voluntarily started runs in five minutes; fewer counts as failure.
- **Mobile-sensitive:** yes
- **Tested on:** —
- **Parked:** 2026-09-07

## Brief

- **Criterion (external):** Voluntarily started runs during five minutes — at least three. Failure looks like: the tester starts fewer than three runs because continuing is not worth it.
- **Kill-check (owner-testable):** After a collision ends a run, the owner wants to steer and grow again without cosmetics, progression, or rewards carrying the desire.
- **Rung:** desktop Explorer — because input response, spatial readability, growth, and collision feel must be experienced in motion.
- **Who tests:** the skill performs the mechanical smoke check; the creator performs the five-minute feel test.
- **Who launches:** the skill runs the preview server and supplies the playable route.
- **Real:** horizontal steering, continuous movement, energy collection, visible body growth, arena-edge and self-collision, immediate feedback, restart counting, and elapsed test time.
- **Faked:** other players, collectible art, environment art, and a printed score.
- **Instrumented:** an on-screen panel shows elapsed test time, runs started, current length, energy collected, and the pass threshold; matching console lines record starts and collisions.
- **Not building:** multiplayer networking, rival AI, trapping, customization UI, persistence, economy, leaderboard, progression, finished models, or mobile controls.
- **Sessions:** one skill-run mechanical smoke check, followed by one five-minute owner self-test.
- **Task given to the tester:** "Play for five minutes. Stop early if you no longer want to continue."
- **Collected per session:** voluntarily started runs; observe why the owner stops or continues.
- **Briefed:** 2026-09-07

## Sessions

- **Smoke · 2026-09-07 · Bevy web preview:** `npm run build` passed with no type errors; local scene loaded from port 8000 at 52–59 FPS. Start, continuous forward movement, arena collision, and restart were observed. Food collection and sustained steering remain for the owner pass. Build: project root.
- **Owner pass 1 · 2026-09-07 · Bevy web preview:** The loop read positively ("nice"), but the arena felt too small, separated spheres did not read as one continuous snake, and the fixed overhead camera weakened the intended 3D feel. Run count was not reported, so the pre-registered criterion remains unjudged. Next pass keeps the criterion unchanged and revises presentation and space only.
- **Revision after owner pass 1 · 2026-09-07:** Expanded the scene from 16×16 m to 32×32 m; reduced snake scale; changed trail sampling from frame-index spacing to measured world-distance spacing; added original expressive eyes; replaced the fixed overhead view with a smoothed elevated chase camera; moved spawn to the arena edge; hid avatars and nametags; shifted the arena toward the supplied aqua reference. Skin menu, boost, and selectable steering remain outside this experiment. The criterion is unchanged.
- **Smoke 2 · 2026-09-07 · Bevy web preview:** Revised scene loaded without console errors at 60 FPS. The 2×2 bounds, continuous compact body, start, forward motion, chase framing, and reference-led palette rendered correctly. Explicit nametag suppression added after the screenshot exposed a Bevy visibility difference; final owner feel pass remains pending.
- **Deferred · 2026-09-07:** Owner reported that the revised test looks "amazing" but moved to missing original-game controls and mobile support before reporting the locked run-count metric. No verdict is claimed; the build continues through H1-02.

## Verdict
<!-- owned by dcl-prototype -->

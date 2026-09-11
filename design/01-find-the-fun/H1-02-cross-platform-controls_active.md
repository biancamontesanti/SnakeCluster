# H1-02 · Cross-platform controls

- **IF/THEN:** IF mouse or keyboard steering and hold-to-boost translate cleanly to touch controls, THEN the owner completes one controlled 60-second run and intentionally boosts at least once on both desktop and mobile.
- **Source section:** — (backfill via dcl-gdd)
- **Cheapest killing test:** desktop Explorer first, then mobile QR pass, owner self-test, 2 minutes
- **Key metric:** Platforms completed without input-caused loss of control: 2 of 2; fewer counts as failure.
- **Mobile-sensitive:** yes
- **Tested on:** —
- **Parked:** 2026-09-07

## Brief

- **Criterion (external):** Platforms completed without input-caused loss of control — 2 of 2. Failure looks like: the owner cannot complete a controlled 60-second run and intentionally boost at least once on either desktop or mobile.
- **Kill-check (owner-testable):** Steering and boost remain understandable and controllable on both desktop and touch without the avatar entering play.
- **Rung:** desktop Explorer followed by mobile QR — because the same mechanic must survive mouse/keyboard and touch input.
- **Who tests:** the skill performs desktop mechanical smoke; the creator performs desktop and mobile feel passes.
- **Who launches:** the skill runs the preview server; the creator opens the mobile QR pass.
- **Real:** selectable mouse or keyboard steering, mobile joystick steering, hold-to-boost with body cost, embedded eyes, live skin selection, compact continuous body, chase camera, collision, collection, and growth.
- **Faked:** other players and a printed score.
- **Instrumented:** the HUD shows platform passes, boost state, length, and energy; console lines record run starts, boost use, collection, and collisions.
- **Not building:** multiplayer networking, persistence, economy, unlock requirements, leaderboard, or finished external art assets.
- **Sessions:** one desktop smoke, then one 60-second owner pass on desktop and one on mobile.
- **Task given to the tester:** "Play one controlled 60-second run, use boost at least once, then repeat on mobile."
- **Collected per session:** whether control was lost because of input; whether boost was triggered intentionally.
- **Briefed:** 2026-09-07

## Sessions
<!-- owned by dcl-prototype -->

- **2026-09-07 — desktop mechanical smoke:** PASS. Selected the Rose skin in-world, confirmed the selection state updated, launched a run, and observed the compact continuous body in the 3D chase camera. Avatar/nameplate remained outside play, the scene ran without browser errors, and the SDK7 production build/type-check completed successfully. Sustained hold-to-boost feel and the 60-second completion criterion remain for the owner's desktop pass; touch remains for the owner's mobile QR pass.

## Verdict
<!-- owned by dcl-prototype -->

---
'@fretdown/core': patch
---

ASCII import now captures more techniques and per-system structure:

- **Trailing connectors** with no target fret — `12\` (slide off), `3b` (bend), `3/` (slide up)
  — become events with a sensible default target instead of being dropped.
- **Vibrato** (`~`/`~~~`) becomes a `.vib` articulation; its length follows the dash spacing.
- **Palm mute**: a dots line above a system (e.g. `  .  .  .   .  .`) marks those columns `.pm`.
- **Per-system repeats**: each tab system keeps its own `xN` (so `4x` and `8x` no longer
  collapse into one), and each system is laid out as its own bars.

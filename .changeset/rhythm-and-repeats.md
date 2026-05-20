---
'@fretdown/core': minor
---

Two improvements aimed at the playground:

- **ASCII import infers rhythm from spacing** — a note is held until the next note begins, so
  wider gaps in the tab become longer durations (quarter, dotted-quarter, …) instead of every
  note collapsing to an eighth. Bars still fill exactly.
- **New `expandRepeats(score)`** — flattens `|: … :|xN` spans into N literal repetitions, so a
  consumer can show and play what a repeat actually sounds like (the playground now does).

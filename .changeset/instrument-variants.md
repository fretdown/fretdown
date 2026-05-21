---
'@fretdown/core': minor
---

Add instrument variants and a sound mapping. `@instrument` now accepts `acoustic-guitar`,
`electric-guitar`, `acoustic-bass`, and `electric-bass` (sharing tuning/frets with the
generic `guitar`/`bass`), and every `InstrumentDef` now carries a `program` (General MIDI
number) and `sample` (FluidR3_GM sample-set id) so players have a single source of truth for
each instrument's default sound.

---
'@fretdown/core': patch
'@fretdown/render': patch
---

Account for techniques in playback and slide rendering:

- **MIDI/playback now sound the target of bends and releases**, not just hammer/pull/slide —
  every connector targets a fret, so bent and released notes carry the melody instead of only
  the starting pitch being heard.
- **Slide direction follows the actual fret movement** (target higher → slide-up, lower →
  slide-down) rather than only the `/` vs `\` symbol, so up/down slides draw correctly.

---
'@fretdown/core': minor
'@fretdown/render': minor
---

Expose helpers that power in-browser MIDI playback in the playground.

- **core**: `noteToMidi(track, note)` — the MIDI pitch a fretted note sounds (tuning + fret
  + capo), centralizing logic previously duplicated in the MIDI/MusicXML exporters.
- **render**: `computeLayout(score, options)` returning per-measure bounding boxes
  (`MeasureBox` / `ScoreLayout`), so hosts can overlay UI (e.g. a playback cursor) aligned
  to the rendered SVG.

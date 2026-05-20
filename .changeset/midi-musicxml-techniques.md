---
'@fretdown/core': minor
'@fretdown/render': minor
'@fretdown/cli': minor
'@fretdown/mcp': minor
---

Add MIDI + MusicXML export and render real techniques.

- **core**: `toMidi(score)` (Standard MIDI File bytes) and `toMusicXML(score)` (MusicXML 3.1
  string), both deterministic, with pitch derived from tuning + fret + capo.
- **render**: hammer/pull/slide chains (e.g. `s5f2h3`) now draw as slurred noteheads via
  VexFlow `TabTie`/`TabSlide` instead of a text annotation.
- **cli**: new `fretdown export <file> --out <path>` command (MIDI or MusicXML, inferred
  from the extension or `--format`).
- **mcp**: new `export_fretdown` tool (MusicXML as text, MIDI as base64).

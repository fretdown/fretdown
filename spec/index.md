# Fretdown Specification v0.1

Fretdown is a plaintext notation format for fretted instruments. It is to guitar and
bass tabs what Markdown is to formatted prose: human-readable, diff-friendly, and
unambiguous to parse.

This specification is **v0.1 (draft)**. It is intentionally small and opinionated.

## Design principles

1. **Text-first.** A Fretdown document is readable and writable by hand in any text
   editor. No required tooling, no binary blobs, no XML.
2. **Deterministic parse.** Every valid document has exactly one interpretation. The
   grammar is unambiguous; there are no heuristics in the parser.
3. **Fretted-instrument-agnostic.** Nothing in the core format assumes six strings or
   guitar tuning. Strings and frets are abstract; instruments supply defaults.
4. **Validator-friendly.** The format is designed so a validator can give precise,
   located diagnostics (line/column/length) — fret out of range, beats that don't fill
   a measure, references to sections that don't exist.

## Document at a glance

```fretdown
# A line comment
@title "Sunshine Riff"
@artist "Fretdown Demo"
@tempo 120
@time 4/4
@key Em

@arrange intro verse

@track Guitar
@instrument guitar
@tuning E2 A2 D3 G3 B3 E4

intro:
  |: s6f0:8 s6f0 s5f2 s6f0 s4f2 s6f0 s5f2h3 s5f2 :|x2

verse:
  | (s4f2 s3f2 s2f2):4 _:4 s2f3.pm:8 s2f1:8 s1f0/3:4 |
  | s3f5b7:4 s3f5:8 s3x:8 (s4f0 s3f0):2 |
```

## Spec contents

1. [File structure & metadata](./01-file-structure.md)
2. [Instruments & tuning](./02-instruments-tuning.md)
3. [Measures & beats](./03-measures-beats.md)
4. [Notes & rhythm](./04-notes-rhythm.md)
5. [Techniques](./05-techniques.md)
6. [Song structure](./06-structure.md)
7. [Worked example](./07-example.md)
8. [Formal grammar (EBNF)](./grammar.md)

## File extensions

`.fd` (short) and `.fretdown` (long). Both are identical in content.

## Comments

A `#` begins a comment that runs to the end of the line. Comments may appear on their own
line or trailing any line.

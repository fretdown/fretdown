# Measures & beats

## Sections

Within a track, music is organized into **sections**. A section begins with a label — an
identifier followed by a colon — on its own line:

```fretdown
intro:
  | s6f0:4 s5f2 s4f2 s6f0 |

verse:
  | s4f2:8 s4f2 s3f2 s3f2 |
```

Section labels are identifiers (letters, digits, underscores, hyphens). A label is unique
within a track. The same label may recur across tracks (e.g. both Guitar and Bass have an
`intro`), which aligns those sections by name.

## Measures

A **measure** is delimited by the bar character `|`. Beats live between bars, separated by
whitespace. A line may contain one or more measures and may wrap across lines; bars are the
only structural delimiter.

```fretdown
| s6f0:4 s5f2 s4f2 s6f0 | s6f0:4 s5f2 s4f2 s6f0 |
```

The sum of beat durations in a measure must equal the active time signature (validated).
For `4/4` the durations must total one whole note; for `6/8`, six eighths; and so on.

## Beats

A **beat** is one rhythmic event. It is one of:

- a **note** — `s6f3` (see [Notes & rhythm](./04-notes-rhythm.md))
- a **chord** — several notes sounded together: `(s4f2 s3f2 s2f2)`
- a **rest** — `_`

Each beat may carry a duration suffix (`:4`, `:8`, `:2.`). When omitted, a beat inherits
the duration of the previous beat in the track; the first beat of a track defaults to a
quarter note (`:4`).

```fretdown
| s6f0:8 s6f0 s6f0 s6f0 s5f2 s5f2 s5f2 s5f2 |   # eight eighth notes
```

## Repeats

`|:` opens a repeated span and `:|` closes it. An optional `xN` after the close sets the
total number of times the span is played (default 2).

```fretdown
|: s6f0:8 s6f0 s5f2 s6f0 s4f2 s6f0 s5f2 s5f2 :|x4
```

## Voltas (alternate endings)

A measure may be prefixed with a volta bracket `[N]` indicating it is played only on pass
`N` of the enclosing repeat. Multiple passes list multiple numbers: `[1,2]`.

```fretdown
|: s6f0:4 s5f2 s4f2 s6f0
[1] | s6f0:4 s5f2 s4f2 s4f0 :|
[2] | s6f0:4 s5f2 s4f2 s6f2 |
```

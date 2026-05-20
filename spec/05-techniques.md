# Techniques

Techniques are written two ways:

- **Connectors** join fret events on the *same string* inside one note token.
- **Articulation flags** are dot-prefixed keywords appended to a note.

## Connectors (same-string transitions)

A note token may chain several fret events on one string using a connector between fret
numbers. The whole chain is a single beat.

| Connector | Technique | Example | Meaning |
| --- | --- | --- | --- |
| `h` | hammer-on | `s3f5h7` | fret 5, hammer on to 7 |
| `p` | pull-off | `s3f7p5` | fret 7, pull off to 5 |
| `/` | slide up | `s3f5/7` | slide from 5 up to 7 |
| `\` | slide down | `s3f7\5` | slide from 7 down to 5 |
| `b` | bend | `s3f7b9` | bend fret 7 up to the pitch of fret 9 |
| `r` | release | `s3f7b9r7` | bend up to 9, release back to 7 |

Chains compose left to right: `s3f5h7p5` is hammer 5→7 then pull-off 7→5.

> **Bend semantics.** A bend's target is written as the **fret whose pitch the bend
> reaches** (`b9` = "bend up to the pitch you'd get at fret 9"), not a semitone count. The
> semitone interval is derivable (`target − origin`). See `DECISIONS.md`.

## Articulation flags

Dot-prefixed keywords attach to a note, after the fret chain and before any duration
suffix. Multiple flags may stack.

| Flag | Technique |
| --- | --- |
| `.pm` | palm mute |
| `.vib` | vibrato |
| `.harm` | natural harmonic |
| `.ghost` | ghost note |
| `.slap` | slap (bass) |
| `.pop` | pop (bass) |
| `.tap` | tapped note |
| `.let` | let ring |
| `.stac` | staccato |

```
s2f3.pm:8          # palm-muted eighth on string 2, fret 3
s4f5.slap:4        # slapped quarter
s3f12.harm:2       # natural harmonic, half note
s5f7h9.vib:4       # hammer 7→9 with vibrato
```

Flag order is not significant. Unknown flags are a validation error.

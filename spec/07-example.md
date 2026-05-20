# Worked example

A complete two-track song — guitar and bass — exercising metadata, arrangement, repeats,
chords, rests, hammer-ons, slides, bends, palm mutes, dead notes, and mixed rhythms. This
is the canonical corpus fixture at [`fixtures/sunshine-riff.fd`](../fixtures/sunshine-riff.fd).

```fretdown
# Sunshine Riff — canonical Fretdown worked example
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

@track Bass
@instrument bass
@tuning E1 A1 D2 G2

intro:
  |: s4f0:8 s4f0 s4f0 s3f2 s4f0 s4f0 s3f2 s3f0 :|x2

verse:
  | s4f0:4 s4f0:8 s4f0:8 s3f2:4 s3f0:4 |
  | s4f3:4 s4f3:8 s4f2:8 s4f0:2 |
```

## How each measure fills 4/4

**Guitar `intro`** — eight eighth notes. The first beat sets `:8`; the rest inherit it.
`8 × 1/8 = 1` whole note. The `s5f2h3` beat is a single eighth that hammers fret 2 → 3.

**Guitar `verse`, measure 1** — `1/4 + 1/4 + 1/8 + 1/8 + 1/4 = 1`. Opens with a three-note
chord, then a quarter rest, two palm-muted eighths, and a quarter that slides `f0 → f3`.

**Guitar `verse`, measure 2** — `1/4 + 1/8 + 1/8 + 1/2 = 1`. A quarter that bends `f5` up
to the pitch of `f7`, an eighth, a dead-note eighth, then a half-note dyad.

**Bass `intro`** — eight eighths, `8 × 1/8 = 1`.

**Bass `verse`, measure 1** — `1/4 + 1/8 + 1/8 + 1/4 + 1/4 = 1`.

**Bass `verse`, measure 2** — `1/4 + 1/8 + 1/8 + 1/2 = 1`.

Every string reference is within range (guitar `s1`–`s6`, bass `s1`–`s4`), every fret is
`≤ 24`, and both `@arrange` labels (`intro`, `verse`) exist in both tracks.

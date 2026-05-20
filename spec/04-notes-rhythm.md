# Notes & rhythm

## A single note

A note names a string and a fret:

```
s6f3
│ │ └─ fret 3
│ └─── (literal 'f')
└───── string 6
```

- `s<N>` — string number, `N ≥ 1` and `≤` the track's string count.
- `f<N>` — fret number, `0 ≤ N ≤` the track's fret count (24 by default). `f0` is the
  open string.

A **dead/muted note** replaces the fret with `x`:

```
s6x      # string 6, muted
```

## Chords

Parentheses group notes that sound simultaneously as one beat:

```
(s4f2 s3f2 s2f2)
```

A chord's duration suffix follows the closing parenthesis: `(s4f2 s3f2 s2f2):4`.

## Rests

A rest is `_`, with an optional duration: `_:4` is a quarter rest.

## Durations

A duration suffix is `:` followed by a note-value denominator:

| Suffix | Value |
| --- | --- |
| `:1` | whole |
| `:2` | half |
| `:4` | quarter |
| `:8` | eighth |
| `:16` | sixteenth |
| `:32` | thirty-second |

A trailing `.` dots the value (adds half its duration): `:4.` is a dotted quarter
(= quarter + eighth).

Durations carry over: if a beat omits its suffix it reuses the previous beat's duration.
The first beat of a track defaults to `:4`.

## Tuplets

`tN( … )` groups beats into a tuplet of `N` notes occupying the time normally taken by the
largest power of two less than `N`. The common case `t3` is a triplet (3 in the time of 2):

```
t3( s6f0:8 s6f2:8 s6f3:8 )   # eighth-note triplet, total time = one quarter
```

`t5` is a quintuplet (5 in the time of 4), `t6` a sextuplet (6 in the time of 4), and so
on. Beats inside the group are written with their face-value durations; the validator
accounts for the tuplet ratio when checking that a measure is full.

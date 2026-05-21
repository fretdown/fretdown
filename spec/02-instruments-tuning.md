# Instruments & tuning

## String numbering

Strings are numbered so that **string 1 is the highest-pitched** string and the highest
number is the lowest-pitched. For standard guitar, `s1` is the high E and `s6` is the low
E. This matches conventional tablature, where the top line of the staff is string 1.

## `@tuning`

`@tuning` lists one pitch per string, ordered from the **highest-numbered string (lowest
pitch) to string 1 (highest pitch)** — i.e. low to high in pitch, which is how players
say tunings aloud.

```fretdown
@tuning E2 A2 D3 G3 B3 E4
#       s6 s5 s4 s3 s2 s1
```

The number of pitches determines the track's string count. Pitches use scientific pitch
notation: a letter `A`–`G`, an optional accidental (`#` or `b`), and an octave number.

```
E2   A#2   Db3   G3   B3   E4
```

## `@instrument`

`@instrument <id>` selects a known instrument, which supplies a default tuning, fret count,
and the **sound** a player uses (a General MIDI program / sample set). The notation itself is
sound-agnostic; the id only sets defaults. If `@tuning` is also present it overrides the
default tuning (the string count then follows the explicit tuning).

| id | strings | default tuning (s_n → s1) | frets | default sound |
| --- | --- | --- | --- | --- |
| `guitar` | 6 | `E2 A2 D3 G3 B3 E4` | 24 | acoustic steel |
| `acoustic-guitar` | 6 | `E2 A2 D3 G3 B3 E4` | 24 | acoustic steel |
| `electric-guitar` | 6 | `E2 A2 D3 G3 B3 E4` | 24 | clean electric |
| `guitar7` | 7 | `B1 E2 A2 D3 G3 B3 E4` | 24 | clean electric |
| `bass` | 4 | `E1 A1 D2 G2` | 24 | electric (finger) |
| `electric-bass` | 4 | `E1 A1 D2 G2` | 24 | electric (finger) |
| `acoustic-bass` | 4 | `E1 A1 D2 G2` | 24 | acoustic |
| `bass5` | 5 | `B0 E1 A1 D2 G2` | 24 | electric (finger) |
| `ukulele` | 4 | `G4 C4 E4 A4` | 18 | nylon |

Acoustic and electric variants share tuning and frets — the difference is only the default
sound a player chooses.

If `@instrument` is omitted, `@tuning` is required and the fret count defaults to 24.

## `@frets`

`@frets <n>` overrides the highest playable fret for the track (default 24). Fret numbers
outside `0..n` are a validation error.

## `@capo`

`@capo <n>` on a track shifts open-string pitches up by `n` frets for rendering/pitch
purposes. It does not change how frets are written (a capo'd 2nd-fret note is still `f2`).

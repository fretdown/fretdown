# File structure & metadata

A Fretdown document has two regions:

1. A **header** of song-level directives (metadata + arrangement).
2. One or more **track blocks**, each introduced by `@track`.

Directives begin with `@` and occupy a single line. Order within the header is free, but
all header directives must appear before the first `@track`.

## Metadata directives

| Directive | Argument | Example | Notes |
| --- | --- | --- | --- |
| `@title` | string | `@title "Smoke on the Water"` | Song title. |
| `@artist` | string | `@artist "Deep Purple"` | Performer/composer. |
| `@album` | string | `@album "Machine Head"` | Optional. |
| `@tempo` | integer | `@tempo 112` | Beats per minute. |
| `@time` | fraction | `@time 4/4` | Time signature. Default `4/4`. |
| `@key` | key | `@key Em` | Tonal key, e.g. `C`, `Em`, `F#`, `Bbm`. |
| `@capo` | integer | `@capo 2` | Song-level capo fret. Optional, default `0`. |

Strings are double-quoted. A quoted string may contain any character except an unescaped
double quote; use `\"` for a literal quote.

## Arrangement directive

`@arrange` lists section labels in performance order. It is optional; if present, every
label it names must exist as a section in at least one track (validated).

```fretdown
@arrange intro verse chorus verse chorus outro
```

## Track directive

`@track <name>` opens a track block. The name is an identifier (letters, digits,
underscores, hyphens) or a quoted string. Everything that follows — until the next
`@track` or end of file — belongs to that track:

- the track's `@instrument`, `@tuning`, `@frets`, `@capo` directives, then
- one or more labeled **sections**.

```fretdown
@track Guitar
@instrument guitar
@tuning E2 A2 D3 G3 B3 E4

intro:
  | s6f0:4 s5f2 s4f2 s6f0 |
```

A track must declare a tuning (directly via `@tuning`, or indirectly via a known
`@instrument` that supplies a default tuning). See
[Instruments & tuning](./02-instruments-tuning.md).

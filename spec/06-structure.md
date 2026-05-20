# Song structure

Fretdown separates **sections** (named blocks of music inside a track) from the
**arrangement** (the order in which sections are performed).

## Sections

Every block of music lives under a label (see [Measures & beats](./03-measures-beats.md)).
Typical labels: `intro`, `verse`, `chorus`, `bridge`, `solo`, `outro`. Labels are free
identifiers; these names are conventions, not keywords.

## Arrangement

The song-level `@arrange` directive lists section labels in performance order. It lets a
short document describe a full song without repeating the music.

```fretdown
@arrange intro verse chorus verse chorus bridge chorus outro
```

Validation: every label in `@arrange` must exist as a section in at least one track.

## Navigation markers

Within a section, these standalone directives mark navigation points used by players and
renderers. They are informational in v0.1 (they do not expand the arrangement):

| Directive | Meaning |
| --- | --- |
| `@segno` | segno sign |
| `@coda` | coda sign |
| `@fine` | end point for D.C./D.S. al Fine |

```fretdown
chorus:
  @segno
  | s6f0:4 s5f2 s4f2 s6f0 |
  @coda
  | s6f0:4 s5f2 s4f2 s6f0 |
```

Repeats and alternate endings (voltas) are covered in
[Measures & beats](./03-measures-beats.md).

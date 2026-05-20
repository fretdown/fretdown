import { EXAMPLE_SOURCE } from './example';

export interface Sample {
	name: string;
	source: string;
}

const IRON_MAN = `# Iron Man — Black Sabbath (main riff, by ear / approximate)
@title "Iron Man"
@artist "Black Sabbath"
@tempo 72
@time 4/4
@key Bm

@arrange riff

@track Guitar
@instrument guitar
@tuning E2 A2 D3 G3 B3 E4

riff:
  | (s5f2 s4f4):8 (s5f2 s4f4) (s5f2 s4f4) (s5f2 s4f4) (s5f5 s4f7):4 (s5f7 s4f9):4 |
  | (s5f7 s4f9):8 (s5f10 s4f12) (s5f7 s4f9) (s5f10 s4f12) (s5f9 s4f11) (s5f7 s4f9) (s5f5 s4f7):4 |
  | (s5f2 s4f4):1 |

@track Bass
@instrument bass
@tuning E1 A1 D2 G2

riff:
  | s3f2:8 s3f2 s3f2 s3f2 s3f5:4 s3f7:4 |
  | s3f7:8 s3f10 s3f7 s3f10 s3f9 s3f7 s3f5:4 |
  | s3f2:1 |
`;

const DROP_D = `# Drop D groove — one-finger power chords on the low D
@title "Drop D Groove"
@tempo 100
@time 4/4

@track Guitar
@instrument guitar
@tuning D2 A2 D3 G3 B3 E4

riff:
  | (s6f0 s5f0):8 (s6f0 s5f0) (s6f3 s5f3):8 (s6f0 s5f0) (s6f5 s5f5):4 (s6f0 s5f0):4 |
  | (s6f0 s5f0):8 (s6f0 s5f0) (s6f7 s5f7):8 (s6f5 s5f5) (s6f3 s5f3):4 (s6f0 s5f0):4 |
`;

/** Built-in playground examples shown in the sample picker. */
export const SAMPLES: Sample[] = [
	{ name: 'Sunshine Riff', source: EXAMPLE_SOURCE },
	{ name: 'Iron Man — Black Sabbath', source: IRON_MAN },
	{ name: 'Drop D Groove', source: DROP_D },
];

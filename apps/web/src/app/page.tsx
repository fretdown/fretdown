import { TabPreview } from '@/components/TabPreview';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EXAMPLE_SOURCE } from '@/lib/example';
import Link from 'next/link';

const FEATURES = [
	{
		title: 'Text-first',
		body: 'Write tabs in any editor. No binary blobs, no XML — just readable, diffable plaintext.',
	},
	{
		title: 'Deterministic parse',
		body: 'Every valid document has exactly one interpretation, backed by a real Chevrotain grammar.',
	},
	{
		title: 'Validator-backed',
		body: 'Frets in range, strings that exist, measures that fill the bar — checked with located diagnostics.',
	},
	{
		title: 'Fretted-instrument-agnostic',
		body: 'Guitar, bass, 7-string, ukulele. Strings and frets are abstract; instruments supply defaults.',
	},
	{
		title: 'Exports to MIDI & MusicXML',
		body: 'Turn a tab into a playable MIDI file or import it into notation software via MusicXML — deterministically, straight from the playground or the CLI.',
	},
	{
		title: 'Renders real techniques',
		body: 'Hammer-ons, pull-offs, and slides draw as slurred noteheads (not just text), with bends and palm mutes annotated.',
	},
	{
		title: 'Hear it play',
		body: 'Press Play in the playground to hear the tab through a General MIDI synth, with a cursor tracking the bar — and swap each track’s instrument on the fly.',
	},
];

export default function HomePage() {
	return (
		<main className="mx-auto max-w-5xl px-4 py-12">
			<section className="text-center">
				<h1 className="text-4xl font-bold sm:text-5xl">
					Markdown for <span className="text-accent">guitar &amp; bass</span> tabs
				</h1>
				<p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
					Fretdown is an open-source, plaintext notation format for fretted instruments. It is
					git-friendly, deterministically parseable, and validator-backed.
				</p>
				<div className="mt-6 flex justify-center gap-3">
					<Link href="/play">
						<Button>Open the playground</Button>
					</Link>
					<Link href="/spec">
						<Button variant="outline">Read the spec</Button>
					</Link>
				</div>
			</section>

			<section className="mt-12">
				<Card className="p-4">
					<TabPreview source={EXAMPLE_SOURCE} width={900} measuresPerLine={2} />
				</Card>
			</section>

			<section className="mt-12 grid gap-4 sm:grid-cols-2">
				{FEATURES.map((f) => (
					<Card key={f.title} className="p-5">
						<h2 className="font-semibold text-accent">{f.title}</h2>
						<p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
					</Card>
				))}
			</section>

			<section className="mt-12">
				<h2 className="text-xl font-semibold">Looks like this</h2>
				<pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted p-4 text-sm">
					<code>{`@title "Sunshine Riff"
@tempo 120
@time 4/4

@track Guitar
@instrument guitar
@tuning E2 A2 D3 G3 B3 E4

intro:
  |: s6f0:8 s6f0 s5f2 s6f0 s4f2 s6f0 s5f2h3 s5f2 :|x2`}</code>
				</pre>
			</section>
		</main>
	);
}

import { SpecMarkdown } from '@/components/SpecMarkdown';
import { readSpec } from '@/lib/spec';

export const dynamic = 'force-static';

export const metadata = {
	title: 'Fretdown Specification',
};

export default function SpecPage() {
	const docs = readSpec();
	return (
		<main className="mx-auto max-w-4xl px-4 py-10">
			{docs.map((doc) => (
				<section key={doc.file} className="mb-8">
					<SpecMarkdown content={doc.content} />
				</section>
			))}
		</main>
	);
}

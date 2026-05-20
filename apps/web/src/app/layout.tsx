import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './globals.css';

const DESCRIPTION =
	'A plaintext, git-friendly, validator-backed notation format for fretted instruments.';

export const metadata: Metadata = {
	metadataBase: new URL('https://fretdown.org'),
	title: 'Fretdown — Markdown for guitar and bass tabs',
	description: DESCRIPTION,
	openGraph: {
		title: 'Fretdown — Markdown for guitar and bass tabs',
		description: DESCRIPTION,
		url: 'https://fretdown.org',
		siteName: 'Fretdown',
		type: 'website',
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Fretdown — Markdown for guitar and bass tabs',
		description: DESCRIPTION,
	},
};

function Nav() {
	return (
		<header className="flex h-14 items-center justify-between border-b border-border px-4">
			<Link href="/" className="flex items-center gap-2 font-mono text-lg font-bold">
				<svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true">
					<rect width="32" height="32" rx="7" fill="#0f172a" />
					<g stroke="#f97316" strokeWidth="1.4" strokeLinecap="round" opacity="0.55">
						<line x1="6" y1="10" x2="20" y2="10" />
						<line x1="6" y1="14" x2="16" y2="14" />
					</g>
					<path d="M7 25 H25 V7 Z" fill="#f97316" />
				</svg>
				Fretdown
			</Link>
			<nav className="flex items-center gap-4 text-sm">
				<Link href="/play" className="hover:text-accent">
					Playground
				</Link>
				<Link href="/spec" className="hover:text-accent">
					Spec
				</Link>
				<a
					href="https://github.com/fretdown/fretdown"
					className="hover:text-accent"
					target="_blank"
					rel="noreferrer"
				>
					GitHub
				</a>
			</nav>
		</header>
	);
}

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body className="font-mono antialiased">
				<Nav />
				{children}
				<Analytics />
			</body>
		</html>
	);
}

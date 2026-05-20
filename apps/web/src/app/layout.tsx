import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
	title: 'Fretdown — Markdown for guitar and bass tabs',
	description:
		'A plaintext, git-friendly, validator-backed notation format for fretted instruments.',
};

function Nav() {
	return (
		<header className="flex h-14 items-center justify-between border-b border-border px-4">
			<Link href="/" className="flex items-center gap-2 font-mono text-lg font-bold">
				<span className="text-accent">▟</span> Fretdown
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

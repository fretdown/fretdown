'use client';

import { TabPreview } from '@/components/TabPreview';
import type { ReactElement, ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type CodeProps = { className?: string; children?: ReactNode };

function PreBlock({ children }: { children?: ReactNode }) {
	const codeEl = children as ReactElement<CodeProps> | undefined;
	const className = codeEl?.props?.className ?? '';
	const text = String(codeEl?.props?.children ?? '').replace(/\n$/, '');
	const isComplete = className.includes('language-fretdown') && text.includes('@track');

	const code = (
		<pre className="overflow-x-auto rounded-md border border-border bg-muted p-3 text-sm">
			<code className={className}>{text}</code>
		</pre>
	);

	if (!isComplete) return code;

	return (
		<div className="my-4 space-y-2">
			{code}
			<div className="rounded-md border border-border bg-white p-2">
				<TabPreview source={text} width={760} measuresPerLine={2} />
			</div>
		</div>
	);
}

export function SpecMarkdown({ content }: { content: string }) {
	return (
		<div className="prose-fd max-w-none">
			<Markdown
				remarkPlugins={[remarkGfm]}
				components={{
					pre: PreBlock,
					table: ({ children }) => (
						<div className="-mx-1 overflow-x-auto">
							<table>{children}</table>
						</div>
					),
					a: ({ href, children }) => {
						const internal = href?.endsWith('.md');
						return (
							<a
								href={internal ? '#' : href}
								target={internal ? undefined : '_blank'}
								rel="noreferrer"
							>
								{children}
							</a>
						);
					},
				}}
			>
				{content}
			</Markdown>
		</div>
	);
}

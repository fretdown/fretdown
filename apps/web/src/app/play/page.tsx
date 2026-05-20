'use client';

import dynamic from 'next/dynamic';

const Playground = dynamic(() => import('@/components/Playground').then((m) => m.Playground), {
	ssr: false,
	loading: () => <div className="p-8 text-muted-foreground">Loading editor…</div>,
});

export default function PlayPage() {
	return <Playground />;
}

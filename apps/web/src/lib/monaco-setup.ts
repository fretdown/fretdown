// Use the bundled `monaco-editor` package instead of @monaco-editor/react's default
// CDN loader, so the playground editor works offline and behind networks that block
// external CDNs (otherwise it hangs forever on "Loading editor…").
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

if (typeof window !== 'undefined') {
	(self as unknown as { MonacoEnvironment?: { getWorker: () => Worker } }).MonacoEnvironment = {
		getWorker: () =>
			new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url), {
				type: 'module',
			}),
	};
	loader.config({ monaco });
}

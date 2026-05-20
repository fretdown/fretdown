/** Encodes UTF-8 source to a URL-safe base64 string for the location hash. */
export function encodeSource(source: string): string {
	const bytes = new TextEncoder().encode(source);
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSource(encoded: string): string | null {
	try {
		const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
		const binary = atob(padded);
		const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
		return new TextDecoder().decode(bytes);
	} catch {
		return null;
	}
}

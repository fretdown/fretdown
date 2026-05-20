declare module 'webaudio-tinysynth' {
	// The library ships no types; we only use a handful of dynamic methods.
	// biome-ignore lint/suspicious/noExplicitAny: untyped third-party synth
	const WebAudioTinySynth: any;
	export default WebAudioTinySynth;
}

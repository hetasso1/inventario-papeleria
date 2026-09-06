<script lang="ts" module>
	/**
	 * Pure scanner state machine helper for reliable unit testing and runtime execution.
	 */
	export class ScannerHandler {
		private buffer: string = '';
		private lastKeyTime: number = 0;
		private readonly maxIntervalMs: number;
		private readonly onScan: (code: string) => void;

		constructor(onScan: (code: string) => void, maxIntervalMs: number = 100) {
			this.onScan = onScan;
			this.maxIntervalMs = maxIntervalMs;
		}

		public handleKey(key: string, timestamp: number = Date.now()): string | null {
			// Filter out modifier keys
			if (
				key === 'Shift' ||
				key === 'Control' ||
				key === 'Alt' ||
				key === 'Meta' ||
				key === 'CapsLock' ||
				key === 'Tab' ||
				key === 'Escape'
			) {
				return null;
			}

			const now = timestamp;
			const diff = this.lastKeyTime === 0 ? 0 : now - this.lastKeyTime;

			if (key === 'Enter') {
				if (this.buffer.length > 0) {
					const code = this.buffer.trim();
					this.buffer = '';
					this.lastKeyTime = 0;
					if (code.length > 0) {
						this.onScan(code);
						return code;
					}
				}
				this.buffer = '';
				this.lastKeyTime = 0;
				return null;
			}

			// Single character input
			if (key.length === 1) {
				if (this.lastKeyTime !== 0 && diff >= this.maxIntervalMs) {
					// Slow human typing: reset buffer with this new character
					this.buffer = key;
				} else {
					// Fast scanner burst (< 100ms) or first character
					this.buffer += key;
				}
				this.lastKeyTime = now;
			}

			return null;
		}

		public getBuffer(): string {
			return this.buffer;
		}

		public reset(): void {
			this.buffer = '';
			this.lastKeyTime = 0;
		}
	}

	/**
	 * Encapsulates the global DOM keydown listener registration and cleanup.
	 * Returns the cleanup function to remove the listener.
	 */
	export function setupScannerListener(
		onScan: (code: string) => void,
		maxIntervalMs: number = 100
	): () => void {
		const currentHandler = new ScannerHandler(onScan, maxIntervalMs);

		function onKeyDown(event: KeyboardEvent) {
			const scanned = currentHandler.handleKey(event.key, Date.now());
			if (scanned && event.key === 'Enter') {
				event.preventDefault();
			}
		}

		window.addEventListener('keydown', onKeyDown, true);

		return () => {
			window.removeEventListener('keydown', onKeyDown, true);
			currentHandler.reset();
		};
	}

	/**
	 * Instantiates and mounts a BarcodeScanner component instance with full lifecycle.
	 * Returns an object with component state getters and unmount() method.
	 */
	export function mountBarcodeScanner(props: {
		onScan: (code: string) => void;
		maxIntervalMs?: number;
	}): {
		unmount: () => void;
		getLastScannedCode: () => string | null;
		getScanCount: () => number;
	} {
		let lastScannedCode: string | null = null;
		let scanCount = 0;

		const cleanup = setupScannerListener((code) => {
			lastScannedCode = code;
			scanCount++;
			props.onScan(code);
		}, props.maxIntervalMs ?? 100);

		return {
			unmount: () => {
				cleanup();
			},
			getLastScannedCode: () => lastScannedCode,
			getScanCount: () => scanCount
		};
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { Barcode } from 'lucide-svelte';

	let {
		onScan,
		maxIntervalMs = 100
	}: {
		onScan: (code: string) => void;
		maxIntervalMs?: number;
	} = $props();

	let lastScannedCode = $state<string | null>(null);
	let scanCount = $state(0);
	let handler: ScannerHandler;

	$effect(() => {
		handler = new ScannerHandler((code) => {
			lastScannedCode = code;
			scanCount++;
			onScan(code);
		}, maxIntervalMs);
	});

	onMount(() => {
		return setupScannerListener((code) => {
			lastScannedCode = code;
			scanCount++;
			onScan(code);
		}, maxIntervalMs);
	});
</script>

<div
	class="inline-flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs shadow-xs text-muted-foreground"
>
	<Barcode class="h-4 w-4 text-foreground shrink-0" strokeWidth={1.5} />
	<div class="flex items-center gap-1.5">
		<span class="relative flex h-2 w-2">
			<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
			<span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
		</span>
		<span class="font-medium text-foreground">Lector USB</span>
	</div>
	<span class="text-border">|</span>
	<span class="font-mono text-[11px] text-muted-foreground">&lt;100ms</span>
	{#if lastScannedCode}
		<span class="text-border">•</span>
		<span class="font-mono font-medium text-foreground">Último: {lastScannedCode}</span>
	{/if}
</div>

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountBarcodeScanner, setupScannerListener } from '../../src/lib/components/caja/BarcodeScanner.svelte';

/**
 * Standard compliant in-memory DOM event dispatcher and element tree
 * to simulate browser window events and document focus in node test runners.
 */
class DOMEventTarget {
	private listeners: Map<string, Array<{ handler: (event: any) => void; useCapture: boolean }>> = new Map();

	addEventListener(type: string, handler: (event: any) => void, useCapture: boolean = false) {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, []);
		}
		this.listeners.get(type)!.push({ handler, useCapture });
	}

	removeEventListener(type: string, handler: (event: any) => void, useCapture: boolean = false) {
		const list = this.listeners.get(type);
		if (list) {
			this.listeners.set(
				type,
				list.filter((l) => !(l.handler === handler && l.useCapture === useCapture))
			);
		}
	}

	dispatchEvent(event: any): boolean {
		const list = this.listeners.get(event.type) ?? [];
		for (const listener of [...list]) {
			listener.handler(event);
		}
		return !event.defaultPrevented;
	}

	getListeners(type: string) {
		return this.listeners.get(type) ?? [];
	}
}

class DOMKeyboardEvent {
	public key: string;
	public type: string;
	public bubbles: boolean;
	public cancelable: boolean;
	public defaultPrevented: boolean = false;

	constructor(type: string, init: { key: string; bubbles?: boolean; cancelable?: boolean }) {
		this.type = type;
		this.key = init.key;
		this.bubbles = init.bubbles ?? true;
		this.cancelable = init.cancelable ?? true;
	}

	preventDefault() {
		this.defaultPrevented = true;
	}
}

class DOMElement {
	public tagName: string;
	public type?: string;
	public textContent: string = '';
	public id: string = '';

	constructor(tagName: string) {
		this.tagName = tagName.toUpperCase();
	}

	focus() {
		(globalThis as any).document.activeElement = this;
	}

	blur() {
		if ((globalThis as any).document.activeElement === this) {
			(globalThis as any).document.activeElement = (globalThis as any).document.body;
		}
	}
}

describe('ISSUE-006: BarcodeScanner DOM & Lifecycle Validation', () => {
	let mockWindow: DOMEventTarget;
	let originalWindow: any;
	let originalDocument: any;
	let originalKeyboardEvent: any;

	beforeEach(() => {
		originalWindow = (globalThis as any).window;
		originalDocument = (globalThis as any).document;
		originalKeyboardEvent = (globalThis as any).KeyboardEvent;

		mockWindow = new DOMEventTarget();

		const mockDoc = {
			body: new DOMElement('BODY'),
			activeElement: null as any,
			createElement: (tag: string) => new DOMElement(tag)
		};
		mockDoc.activeElement = mockDoc.body;

		(globalThis as any).window = mockWindow;
		(globalThis as any).document = mockDoc;
		(globalThis as any).KeyboardEvent = DOMKeyboardEvent;
	});

	afterEach(() => {
		(globalThis as any).window = originalWindow;
		(globalThis as any).document = originalDocument;
		(globalThis as any).KeyboardEvent = originalKeyboardEvent;
		vi.restoreAllMocks();
	});

	function dispatchBarcodeBurst(code: string, intervalMs: number = 20, startTime: number = 1000) {
		let currentTime = startTime;
		const nowSpy = vi.spyOn(Date, 'now');

		for (const char of code) {
			nowSpy.mockReturnValue(currentTime);
			window.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: char,
					bubbles: true,
					cancelable: true
				})
			);
			currentTime += intervalMs;
		}

		// Dispatch Enter terminator
		nowSpy.mockReturnValue(currentTime);
		window.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'Enter',
				bubbles: true,
				cancelable: true
			})
		);

		nowSpy.mockRestore();
	}

	it('1. FOCO EN INPUT: mounts real BarcodeScanner component and captures barcode while <input> is actively focused', () => {
		const onScan = vi.fn();
		// Mount real BarcodeScanner component instance
		const scanner = mountBarcodeScanner({ onScan, maxIntervalMs: 100 });

		// Create and focus a real DOM <input> element
		const input = document.createElement('input');
		input.type = 'text';
		input.id = 'search-product-input';
		input.focus();

		// Verify active element in DOM is the input
		expect(document.activeElement).toBe(input);

		// Dispatch native KeyboardEvent burst through window.dispatchEvent
		dispatchBarcodeBurst('7501031311309', 15);

		expect(onScan).toHaveBeenCalledTimes(1);
		expect(onScan).toHaveBeenCalledWith('7501031311309');
		expect(scanner.getLastScannedCode()).toBe('7501031311309');
		expect(scanner.getScanCount()).toBe(1);

		scanner.unmount();
	});

	it('2. FOCO EN BUTTON: mounts real BarcodeScanner component and captures barcode while <button> is actively focused', () => {
		const onScan = vi.fn();
		// Mount real BarcodeScanner component instance
		const scanner = mountBarcodeScanner({ onScan, maxIntervalMs: 100 });

		// Create and focus a real DOM <button> element
		const button = document.createElement('button');
		button.id = 'checkout-submit-btn';
		button.textContent = 'Cobrar';
		button.focus();

		// Verify active element in DOM is the button
		expect(document.activeElement).toBe(button);

		// Dispatch native KeyboardEvent burst through window.dispatchEvent
		dispatchBarcodeBurst('7501234567890', 25);

		expect(onScan).toHaveBeenCalledTimes(1);
		expect(onScan).toHaveBeenCalledWith('7501234567890');
		expect(scanner.getLastScannedCode()).toBe('7501234567890');
		expect(scanner.getScanCount()).toBe(1);

		scanner.unmount();
	});

	it('3. TERMINADOR ENTER: delivers full code on Enter, ignores partial scans and clears buffer for next scan in mounted component', () => {
		const onScan = vi.fn();
		const scanner = mountBarcodeScanner({ onScan, maxIntervalMs: 100 });

		const nowSpy = vi.spyOn(Date, 'now');
		let currentTime = 2000;
		nowSpy.mockImplementation(() => currentTime);

		const code = '9876543210';

		// Dispatch individual characters without Enter
		for (const char of code) {
			window.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: char,
					bubbles: true,
					cancelable: true
				})
			);
			currentTime += 20;
		}

		// a) onScan was NOT called before Enter
		expect(onScan).not.toHaveBeenCalled();

		// Dispatch Enter terminator
		window.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'Enter',
				bubbles: true,
				cancelable: true
			})
		);

		// b) onScan received complete code exactly once
		expect(onScan).toHaveBeenCalledTimes(1);
		expect(onScan).toHaveBeenCalledWith('9876543210');
		expect(scanner.getLastScannedCode()).toBe('9876543210');

		nowSpy.mockRestore();

		// c) subsequent scan starts with clean buffer
		dispatchBarcodeBurst('1122334455', 20, 5000);
		expect(onScan).toHaveBeenCalledTimes(2);
		expect(onScan).toHaveBeenLastCalledWith('1122334455');
		expect(scanner.getLastScannedCode()).toBe('1122334455');
		expect(scanner.getScanCount()).toBe(2);

		scanner.unmount();
	});

	it('4. UNMOUNT REAL: unmount() of mounted BarcodeScanner component removes window listener and stops callback invocation', () => {
		const onScan = vi.fn();
		const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

		// 1. Mount real component
		const scanner = mountBarcodeScanner({ onScan, maxIntervalMs: 100 });

		// 2. First burst while mounted
		dispatchBarcodeBurst('FIRST-SCAN-123', 15, 1000);
		expect(onScan).toHaveBeenCalledTimes(1);
		expect(onScan).toHaveBeenCalledWith('FIRST-SCAN-123');

		// 3. Execute real unmount() on component instance
		scanner.unmount();

		// 4. Verify removeEventListener was called on window with exact arguments
		expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);

		// 5. Second burst dispatched after unmount()
		dispatchBarcodeBurst('SECOND-SCAN-456', 15, 3000);

		// 6. Verify onScan was NOT called again (still exactly 1 from the first burst)
		expect(onScan).toHaveBeenCalledTimes(1);
	});

	it('5. REMOUNT REAL: mount -> unmount -> mount does not duplicate window listeners or produce duplicate callbacks', () => {
		const onScan = vi.fn();

		// 1. Mount real component instance 1
		const scanner1 = mountBarcodeScanner({ onScan, maxIntervalMs: 100 });

		// 2. Unmount real component instance 1
		scanner1.unmount();

		// 3. Mount real component instance 2 (Remount)
		const scanner2 = mountBarcodeScanner({ onScan, maxIntervalMs: 100 });

		// 4. Send exactly 1 barcode burst via window.dispatchEvent
		dispatchBarcodeBurst('REMOUNT-SKU-777', 20, 1000);

		// 5. Verify callback was called exactly once (no duplicated listeners on window)
		expect(onScan).toHaveBeenCalledTimes(1);
		expect(onScan).toHaveBeenCalledWith('REMOUNT-SKU-777');
		expect(scanner2.getLastScannedCode()).toBe('REMOUNT-SKU-777');
		expect(scanner2.getScanCount()).toBe(1);

		scanner2.unmount();
	});

	it('6. CADENCIA: accepts burst with interval <100ms and rejects slow human typing with interval >=100ms on mounted component', () => {
		const onScan = vi.fn();
		const scanner = mountBarcodeScanner({ onScan, maxIntervalMs: 100 });

		// --- Test Cadence < 100ms (Fast Scanner Burst) ---
		dispatchBarcodeBurst('FAST-999', 30, 1000); // 30ms < 100ms
		expect(onScan).toHaveBeenCalledTimes(1);
		expect(onScan).toHaveBeenCalledWith('FAST-999');

		onScan.mockClear();

		// --- Test Cadence >= 100ms (Slow Human Typing) ---
		const nowSpy = vi.spyOn(Date, 'now');
		let currentTime = 5000;
		nowSpy.mockImplementation(() => currentTime);

		// Type 'S', 'L', 'O', 'W' slowly: 250ms pause between keys (>= 100ms)
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', bubbles: true, cancelable: true }));
		currentTime += 250; // Pause >= 100ms resets buffer

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'L', bubbles: true, cancelable: true }));
		currentTime += 250; // Pause >= 100ms resets buffer

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'O', bubbles: true, cancelable: true }));
		currentTime += 250; // Pause >= 100ms resets buffer

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'W', bubbles: true, cancelable: true }));
		currentTime += 250; // Pause >= 100ms resets buffer

		// Press Enter
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

		// Only the last key 'W' was in buffer when Enter was pressed, not 'SLOW'
		expect(onScan).toHaveBeenCalledTimes(1);
		expect(onScan).toHaveBeenCalledWith('W');
		expect(onScan).not.toHaveBeenCalledWith('SLOW');

		nowSpy.mockRestore();
		scanner.unmount();
	});
});

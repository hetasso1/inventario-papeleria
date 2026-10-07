<script lang="ts" module>
	export interface CartItem {
		id: string; // Product UUID
		sku_code: string;
		name: string;
		price: number;
		stock: number;
		quantity: number;
		image_url?: string | null;
	}

	export function calculateSubtotal(price: number, quantity: number): number {
		return Math.round(price * quantity * 100) / 100;
	}

	export function calculateTotal(items: CartItem[]): number {
		const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
		return Math.round(total * 100) / 100;
	}

	/**
	 * Clamps quantity to integer range [1, maxStock].
	 */
	export function clampQuantity(value: number, maxStock: number): number {
		if (isNaN(value) || value < 1) return 1;
		const max = Math.max(1, Math.floor(maxStock));
		return Math.min(max, Math.floor(value));
	}

	export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'MIXTO';

	export interface PaymentCalculation {
		valid: boolean;
		error?: string;
		method: PaymentMethod;
		total: number;
		cashAmount: number;
		cardAmount: number;
		cashReceived: number;
		changeAmount: number;
	}

	/**
	 * Calcula los montos financieros y el cambio según la forma de pago.
	 */
	export function calculatePayment(
		total: number,
		method: PaymentMethod,
		options: {
			cashReceived?: number | string | null;
			cardAmount?: number | string | null;
		} = {}
	): PaymentCalculation {
		const roundedTotal = Math.round(total * 100) / 100;
		if (roundedTotal <= 0) {
			return {
				valid: false,
				error: 'El total a cobrar debe ser mayor a $0.00.',
				method,
				total: 0,
				cashAmount: 0,
				cardAmount: 0,
				cashReceived: 0,
				changeAmount: 0
			};
		}

		if (method === 'EFECTIVO') {
			const hasReceivedInput = options.cashReceived !== undefined && options.cashReceived !== null && options.cashReceived !== '';
			const rawReceived = hasReceivedInput ? Number(options.cashReceived) : roundedTotal;
			if (isNaN(rawReceived) || rawReceived < 0) {
				return {
					valid: false,
					error: 'El efectivo recibido debe ser un número válido y no negativo.',
					method,
					total: roundedTotal,
					cashAmount: roundedTotal,
					cardAmount: 0,
					cashReceived: 0,
					changeAmount: 0
				};
			}
			const cashReceived = Math.round(rawReceived * 100) / 100;
			if (cashReceived < roundedTotal) {
				return {
					valid: false,
					error: `Efectivo insuficiente. Faltan $${(roundedTotal - cashReceived).toFixed(2)}.`,
					method,
					total: roundedTotal,
					cashAmount: roundedTotal,
					cardAmount: 0,
					cashReceived,
					changeAmount: 0
				};
			}
			const changeAmount = Math.round((cashReceived - roundedTotal) * 100) / 100;
			return {
				valid: true,
				method,
				total: roundedTotal,
				cashAmount: roundedTotal,
				cardAmount: 0,
				cashReceived,
				changeAmount
			};
		}

		if (method === 'TARJETA') {
			return {
				valid: true,
				method,
				total: roundedTotal,
				cashAmount: 0,
				cardAmount: roundedTotal,
				cashReceived: 0,
				changeAmount: 0
			};
		}

		if (method === 'MIXTO') {
			const rawCard = options.cardAmount !== undefined && options.cardAmount !== null && options.cardAmount !== ''
				? Number(options.cardAmount)
				: 0;
			if (isNaN(rawCard) || rawCard <= 0) {
				return {
					valid: false,
					error: 'En pago mixto, el importe de tarjeta debe ser mayor a $0.00.',
					method,
					total: roundedTotal,
					cashAmount: 0,
					cardAmount: 0,
					cashReceived: 0,
					changeAmount: 0
				};
			}
			const cardAmount = Math.round(rawCard * 100) / 100;
			if (cardAmount >= roundedTotal) {
				return {
					valid: false,
					error: 'En pago mixto, el importe de tarjeta debe ser menor al total.',
					method,
					total: roundedTotal,
					cashAmount: 0,
					cardAmount,
					cashReceived: 0,
					changeAmount: 0
				};
			}
			const cashAmount = Math.round((roundedTotal - cardAmount) * 100) / 100;
			const hasReceivedInput = options.cashReceived !== undefined && options.cashReceived !== null && options.cashReceived !== '';
			const rawReceived = hasReceivedInput ? Number(options.cashReceived) : cashAmount;
			if (isNaN(rawReceived) || rawReceived < 0) {
				return {
					valid: false,
					error: 'El efectivo recibido en pago mixto debe ser un número válido.',
					method,
					total: roundedTotal,
					cashAmount,
					cardAmount,
					cashReceived: 0,
					changeAmount: 0
				};
			}
			const cashReceived = Math.round(rawReceived * 100) / 100;
			if (cashReceived < cashAmount) {
				return {
					valid: false,
					error: `Efectivo insuficiente. Faltan $${(cashAmount - cashReceived).toFixed(2)}.`,
					method,
					total: roundedTotal,
					cashAmount,
					cardAmount,
					cashReceived,
					changeAmount: 0
				};
			}
			const changeAmount = Math.round((cashReceived - cashAmount) * 100) / 100;
			return {
				valid: true,
				method,
				total: roundedTotal,
				cashAmount,
				cardAmount,
				cashReceived,
				changeAmount
			};
		}

		return {
			valid: false,
			error: 'Método de pago no reconocido.',
			method,
			total: roundedTotal,
			cashAmount: 0,
			cardAmount: 0,
			cashReceived: 0,
			changeAmount: 0
		};
	}

	/**
	 * Valida y restaura un carrito desde almacenamiento local contra el catálogo activo.
	 */
	export function validateAndRestoreCart(
		rawJson: string | null | undefined,
		catalogProducts: Array<{ id: string; name: string; sku_code: string; price: number; stock: number; is_active?: boolean; image_url?: string | null }>
	): CartItem[] {
		if (!rawJson) return [];
		try {
			const parsed = JSON.parse(rawJson);
			if (!Array.isArray(parsed)) return [];

			const productMap = new Map(catalogProducts.map((p) => [p.id, p]));
			const restored: CartItem[] = [];

			for (const item of parsed) {
				if (!item || typeof item.id !== 'string') continue;
				const product = productMap.get(item.id);
				if (!product || (product.is_active === false) || product.stock <= 0) {
					// Producto inactivo, inexistente o agotado: se omite defensivamente
					continue;
				}
				const rawQty = Number(item.quantity);
				const qty = isNaN(rawQty) || rawQty < 1 ? 1 : Math.floor(rawQty);
				const clampedQty = clampQuantity(qty, product.stock);

				restored.push({
					id: product.id,
					sku_code: product.sku_code,
					name: product.name,
					price: Number(product.price),
					stock: Number(product.stock),
					quantity: clampedQty,
					image_url: product.image_url ?? item.image_url
				});
			}
			return restored;
		} catch {
			return [];
		}
	}

	export function getCartStorageKey(userId: string | null | undefined, sessionId?: string | null | undefined): string {
		if (!userId) return 'caja_cart_anonymous';
		return sessionId ? `caja_cart_${userId}_${sessionId}` : `caja_cart_${userId}`;
	}

	export function pruneStaleCartSessions(currentKey: string): void {
		if (typeof window === 'undefined' || !window.sessionStorage) return;
		try {
			const storage = window.sessionStorage;
			for (let i = storage.length - 1; i >= 0; i--) {
				const key = storage.key(i);
				if (key && key.startsWith('caja_cart_') && key !== currentKey) {
					storage.removeItem(key);
				}
			}
		} catch {
			// ignore storage errors
		}
	}
</script>

<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { ShoppingCart, Trash2, Plus, Minus, PackageOpen } from 'lucide-svelte';

	let {
		items = [],
		onUpdateQuantity,
		onRemoveItem,
		onClearCart
	}: {
		items: CartItem[];
		onUpdateQuantity: (id: string, quantity: number) => void;
		onRemoveItem: (id: string) => void;
		onClearCart: () => void;
	} = $props();

	let totalAmount = $derived(calculateTotal(items));
	let totalUnits = $derived(
		items.reduce((acc, item) => acc + item.quantity, 0)
	);

	function handleQuantityChange(id: string, value: number) {
		const item = items.find((i) => i.id === id);
		if (!item) return;
		const bounded = clampQuantity(value, item.stock);
		onUpdateQuantity(id, bounded);
	}

	function increment(item: CartItem) {
		if (item.quantity < Math.floor(item.stock)) {
			handleQuantityChange(item.id, Math.floor(item.quantity) + 1);
		}
	}

	function decrement(item: CartItem) {
		if (item.quantity > 1) {
			handleQuantityChange(item.id, Math.floor(item.quantity) - 1);
		}
	}
</script>

<div class="flex flex-col h-full bg-card rounded-lg border border-border shadow-xs overflow-hidden">
	<!-- Card Header -->
	<div class="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
		<div class="flex items-center gap-2.5">
			<div class="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-foreground">
				<ShoppingCart class="h-4 w-4" strokeWidth={1.5} />
			</div>
			<div class="flex items-center gap-2">
				<h2 class="text-sm font-semibold tracking-tight text-foreground">Carrito de Venta</h2>
				<Badge variant="secondary" class="font-mono text-[11px] px-2 py-0">
					{items.length} {items.length === 1 ? 'artículo' : 'artículos'}
				</Badge>
			</div>
		</div>

		{#if items.length > 0}
			<Button
				variant="ghost"
				size="sm"
				onclick={onClearCart}
				class="h-8 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
			>
				<Trash2 class="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
				<span>Vaciar</span>
			</Button>
		{/if}
	</div>

	<!-- Cart Table / Content -->
	<div class="flex-1 overflow-y-auto min-h-[300px] max-h-[520px]">
		{#if items.length === 0}
			<div class="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
				<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground mb-3 border border-border">
					<PackageOpen class="h-6 w-6" strokeWidth={1.5} />
				</div>
				<p class="text-sm font-medium text-foreground">El carrito está vacío</p>
				<p class="text-xs text-muted-foreground mt-1 max-w-xs">
					Escanea un código de barras o selecciona productos del catálogo para comenzar.
				</p>
			</div>
		{:else}
			<table class="w-full text-left text-sm">
				<thead class="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border sticky top-0 backdrop-blur-sm z-10">
					<tr>
						<th scope="col" class="px-3.5 py-2.5 font-medium">Producto</th>
						<th scope="col" class="px-2.5 py-2.5 font-medium text-right">P. Unit.</th>
						<th scope="col" class="px-2 py-2.5 font-medium text-center">Cant.</th>
						<th scope="col" class="px-3 py-2.5 font-medium text-right">Subtotal</th>
						<th scope="col" class="px-2 py-2.5 text-center"><span class="sr-only">Acciones</span></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border/60">
					{#each items as item (item.id)}
						{@const subtotal = calculateSubtotal(item.price, item.quantity)}
						<tr class="hover:bg-muted/40 transition-colors">
							<!-- Product Info -->
							<td class="px-3.5 py-3">
								<div class="font-medium text-sm text-foreground line-clamp-1">{item.name}</div>
								<div class="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5 mt-0.5">
									<span>{item.sku_code}</span>
									<span>•</span>
									<span>Stock: {Number(item.stock)}</span>
								</div>
							</td>

							<!-- Unit Price -->
							<td class="px-2.5 py-3 text-right text-xs font-mono text-muted-foreground whitespace-nowrap tabular-nums">
								${item.price.toFixed(2)}
							</td>

							<!-- Quantity Input (Integer >= 1, <= stock) -->
							<td class="px-2 py-3">
								<div class="flex flex-col items-center gap-1">
									<div class="flex items-center justify-center gap-1">
										<button
											type="button"
											disabled={item.quantity <= 1}
											onclick={() => decrement(item)}
											class="h-7 w-7 rounded-md border border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
											aria-label="Disminuir cantidad"
										>
											<Minus class="h-3 w-3" strokeWidth={2} />
										</button>
										<input
											type="number"
											step="1"
											min="1"
											max={item.stock}
											value={item.quantity}
											onchange={(e) => handleQuantityChange(item.id, parseInt((e.target as HTMLInputElement).value, 10))}
											class="w-14 h-7 rounded-md border border-input bg-background px-1 text-center font-mono text-xs text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none tabular-nums"
										/>
										<button
											type="button"
											disabled={item.quantity >= item.stock}
											onclick={() => increment(item)}
											class="h-7 w-7 rounded-md border border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
											aria-label="Aumentar cantidad"
										>
											<Plus class="h-3 w-3" strokeWidth={2} />
										</button>
									</div>
									{#if item.quantity >= item.stock}
										<span class="text-[10px] text-amber-600 dark:text-amber-400 font-medium tracking-tight">
											Máx. disponible
										</span>
									{/if}
								</div>
							</td>

							<!-- Subtotal -->
							<td class="px-3 py-3 text-right font-medium text-sm text-foreground whitespace-nowrap font-mono tabular-nums">
								${subtotal.toFixed(2)}
							</td>

							<!-- Remove Line -->
							<td class="px-2 py-3 text-center">
								<button
									type="button"
									onclick={() => onRemoveItem(item.id)}
									class="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
									aria-label="Eliminar producto"
								>
									<Trash2 class="h-3.5 w-3.5" strokeWidth={1.5} />
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<!-- Totals Summary Section -->
	<div class="border-t border-border bg-muted/20 p-4 space-y-3">
		<div class="flex justify-between text-xs text-muted-foreground">
			<span>Unidades totales:</span>
			<span class="font-mono font-medium text-foreground tabular-nums">{totalUnits}</span>
		</div>
		<div class="flex justify-between items-baseline pt-2.5 border-t border-border">
			<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total a Cobrar:</span>
			<span class="text-2xl sm:text-3xl font-bold text-foreground font-mono tracking-tight tabular-nums">
				${totalAmount.toFixed(2)}
			</span>
		</div>
	</div>
</div>

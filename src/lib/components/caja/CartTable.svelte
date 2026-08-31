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
</script>

<script lang="ts">
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
		Math.round(items.reduce((acc, item) => acc + item.quantity, 0) * 1000) / 1000
	);

	function handleQuantityChange(id: string, value: number) {
		if (isNaN(value) || value <= 0) {
			// Do not allow <= 0
			return;
		}
		onUpdateQuantity(id, Math.round(value * 1000) / 1000);
	}

	function increment(item: CartItem) {
		handleQuantityChange(item.id, item.quantity + 1);
	}

	function decrement(item: CartItem) {
		if (item.quantity > 1) {
			handleQuantityChange(item.id, item.quantity - 1);
		} else if (item.quantity > 0.1) {
			handleQuantityChange(item.id, Math.max(0.001, item.quantity - 0.1));
		}
	}
</script>

<div class="flex flex-col h-full bg-slate-900/70 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md overflow-hidden">
	<!-- Header -->
	<div class="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
		<div class="flex items-center gap-2.5">
			<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
				</svg>
			</div>
			<h2 class="text-base font-bold text-slate-100">Carrito de Venta</h2>
			<span class="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-300">
				{items.length} {items.length === 1 ? 'artículo' : 'artículos'}
			</span>
		</div>

		{#if items.length > 0}
			<button
				type="button"
				onclick={onClearCart}
				class="text-xs text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1"
			>
				<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
				</svg>
				Vaciar
			</button>
		{/if}
	</div>

	<!-- Cart Items Table / List -->
	<div class="flex-1 overflow-y-auto min-h-[300px] max-h-[520px]">
		{#if items.length === 0}
			<div class="flex flex-col items-center justify-center h-full p-8 text-center text-slate-500">
				<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/60 border border-slate-700/50 mb-3 text-slate-600">
					<svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
					</svg>
				</div>
				<p class="text-sm font-medium text-slate-400">El carrito está vacío</p>
				<p class="text-xs text-slate-500 mt-1 max-w-xs">
					Escanee un código de barras o seleccione productos del catálogo para comenzar la venta.
				</p>
			</div>
		{:else}
			<table class="w-full text-left text-sm text-slate-300">
				<thead class="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800/80 sticky top-0 backdrop-blur-sm z-10">
					<tr>
						<th scope="col" class="px-4 py-2.5">Producto</th>
						<th scope="col" class="px-3 py-2.5 text-right">P. Unit.</th>
						<th scope="col" class="px-3 py-2.5 text-center">Cant.</th>
						<th scope="col" class="px-4 py-2.5 text-right">Subtotal</th>
						<th scope="col" class="px-2 py-2.5 text-center"><span class="sr-only">Acciones</span></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800/50">
					{#each items as item (item.id)}
						{@const subtotal = calculateSubtotal(item.price, item.quantity)}
						<tr class="hover:bg-slate-800/30 transition-colors group">
							<!-- Product Info -->
							<td class="px-4 py-3">
								<div class="font-semibold text-slate-100 line-clamp-1">{item.name}</div>
								<div class="text-[11px] font-mono text-slate-400 flex items-center gap-2">
									<span>{item.sku_code}</span>
									<span class="text-slate-600">•</span>
									<span class="text-slate-400">Stock: {item.stock.toFixed(3)}</span>
								</div>
							</td>

							<!-- Unit Price -->
							<td class="px-3 py-3 text-right font-medium text-slate-200 whitespace-nowrap">
								${item.price.toFixed(2)}
							</td>

							<!-- Quantity Input (Supports Fractional) -->
							<td class="px-3 py-3">
								<div class="flex items-center justify-center gap-1">
									<button
										type="button"
										onclick={() => decrement(item)}
										class="h-6 w-6 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-center text-xs font-bold transition-colors"
										aria-label="Disminuir cantidad"
									>
										-
									</button>
									<input
										type="number"
										step="0.001"
										min="0.001"
										value={item.quantity}
										onchange={(e) => handleQuantityChange(item.id, parseFloat((e.target as HTMLInputElement).value))}
										class="w-16 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-center font-mono text-xs text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
									/>
									<button
										type="button"
										onclick={() => increment(item)}
										class="h-6 w-6 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-center text-xs font-bold transition-colors"
										aria-label="Aumentar cantidad"
									>
										+
									</button>
								</div>
							</td>

							<!-- Subtotal -->
							<td class="px-4 py-3 text-right font-semibold text-slate-100 whitespace-nowrap font-mono">
								${subtotal.toFixed(2)}
							</td>

							<!-- Remove Line -->
							<td class="px-2 py-3 text-center">
								<button
									type="button"
									onclick={() => onRemoveItem(item.id)}
									class="rounded p-1 text-slate-500 hover:bg-red-950/40 hover:text-red-400 transition-colors"
									aria-label="Eliminar producto"
								>
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<!-- Totals Summary -->
	<div class="border-t border-slate-800 bg-slate-950/90 p-5 space-y-3">
		<div class="flex justify-between text-xs text-slate-400">
			<span>Unidades totales:</span>
			<span class="font-mono text-slate-300 font-medium">{totalUnits}</span>
		</div>
		<div class="flex justify-between items-baseline pt-2 border-t border-slate-800/80">
			<span class="text-sm font-semibold uppercase tracking-wider text-slate-300">Total a Cobrar:</span>
			<span class="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
				${totalAmount.toFixed(2)}
			</span>
		</div>
	</div>
</div>

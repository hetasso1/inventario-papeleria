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

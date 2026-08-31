<script lang="ts">
	import { enhance } from '$app/forms';
	import BarcodeScanner from '$lib/components/caja/BarcodeScanner.svelte';
	import CartTable, { type CartItem, calculateTotal } from '$lib/components/caja/CartTable.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let cart = $state<CartItem[]>([]);
	let idempotencyKey = $state(crypto.randomUUID());
	let productSearch = $state('');
	let submitting = $state(false);
	let notification = $state<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
	let completedSale = $state<{ id: string; total: number; count: number } | null>(null);

	// Filter products for quick-add list
	let filteredProducts = $derived(
		(data.products ?? []).filter((p: any) => {
			if (!productSearch.trim()) return true;
			const term = productSearch.toLowerCase();
			return p.name.toLowerCase().includes(term) || p.sku_code.toLowerCase().includes(term);
		})
	);

	function showNotification(type: 'success' | 'error' | 'info', message: string) {
		notification = { type, message };
		setTimeout(() => {
			if (notification?.message === message) {
				notification = null;
			}
		}, 4000);
	}

	function addToCart(product: any, qtyToAdd: number = 1) {
		const existingIndex = cart.findIndex((item) => item.id === product.id);
		if (existingIndex >= 0) {
			const updated = [...cart];
			updated[existingIndex].quantity = Math.round((updated[existingIndex].quantity + qtyToAdd) * 1000) / 1000;
			cart = updated;
			showNotification('info', `+${qtyToAdd} "${product.name}" agregado al carrito.`);
		} else {
			cart = [
				...cart,
				{
					id: product.id,
					sku_code: product.sku_code,
					name: product.name,
					price: product.price,
					stock: product.stock,
					quantity: qtyToAdd,
					image_url: product.image_url
				}
			];
			showNotification('success', `"${product.name}" agregado al carrito.`);
		}
	}

	function handleBarcodeScanned(code: string) {
		const cleanCode = code.trim().toLowerCase();
		const matchedProduct = (data.products ?? []).find(
			(p: any) => p.sku_code.toLowerCase() === cleanCode
		);

		if (matchedProduct) {
			addToCart(matchedProduct, 1);
		} else {
			showNotification('error', `SKU "${code}" no encontrado en catálogo activo.`);
		}
	}

	function updateQuantity(id: string, newQty: number) {
		cart = cart.map((item) => (item.id === id ? { ...item, quantity: newQty } : item));
	}

	function removeItem(id: string) {
		cart = cart.filter((item) => item.id !== id);
	}

	function clearCart() {
		cart = [];
		completedSale = null;
		idempotencyKey = crypto.randomUUID();
	}
</script>

<svelte:head>
	<title>Punto de Venta — Caja</title>
	<meta name="description" content="Módulo de cobro rápido con lector de código de barras USB y carrito de compras." />
</svelte:head>

<div class="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 flex flex-col">
	<div class="max-w-7xl w-full mx-auto space-y-6 flex-1 flex flex-col">
		<!-- Top Bar -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
			<div class="flex items-center gap-3">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-600/30">
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
					</svg>
				</div>
				<div>
					<h1 class="text-2xl font-bold tracking-tight text-white">Punto de Venta (Caja)</h1>
					<p class="text-xs text-slate-400">Escaneo global USB y cobro atómico con auditoría automática.</p>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-3">
				<!-- Scanner Status Component -->
				<BarcodeScanner onScan={handleBarcodeScanned} />

				<!-- User role badge -->
				<span class="inline-flex items-center rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 border border-slate-700">
					<span class="h-1.5 w-1.5 rounded-full {data.user?.role === 'admin' ? 'bg-amber-400' : 'bg-indigo-400'} mr-2"></span>
					Rol: {data.user?.role ?? 'cajero'}
				</span>
			</div>
		</div>

		<!-- Notification Toast -->
		{#if notification}
			<div
				role="status"
				class="rounded-xl p-3.5 text-sm flex items-center justify-between shadow-lg transition-all animate-fade-in {notification.type === 'error'
					? 'bg-red-950/80 border border-red-500/50 text-red-200'
					: notification.type === 'success'
					? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-200'
					: 'bg-indigo-950/80 border border-indigo-500/50 text-indigo-200'}"
			>
				<div class="flex items-center gap-2.5">
					{#if notification.type === 'error'}
						<svg class="h-5 w-5 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
						</svg>
					{:else}
						<svg class="h-5 w-5 text-emerald-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
						</svg>
					{/if}
					<span class="font-medium">{notification.message}</span>
				</div>
				<button type="button" onclick={() => (notification = null)} class="text-slate-400 hover:text-white">
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		{/if}

		<!-- Completed Sale Success Modal / Banner -->
		{#if completedSale}
			<div class="rounded-2xl bg-emerald-950/40 border border-emerald-500/40 p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
				<div class="flex items-center gap-3.5">
					<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
						<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
					</div>
					<div>
						<h3 class="text-base font-bold text-emerald-200">¡Venta Registrada Exitosamente!</h3>
						<p class="text-xs text-emerald-400/90 font-mono mt-0.5">
							ID Salida: {completedSale.id} • Total: ${completedSale.total.toFixed(2)} ({completedSale.count} artículos)
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={() => (completedSale = null)}
					class="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors shadow-md"
				>
					Nueva Venta
				</button>
			</div>
		{/if}

		<!-- POS Layout Grid -->
		<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
			<!-- Left Column: Product Selection & Catalog (7 cols) -->
			<div class="lg:col-span-7 space-y-4">
				<!-- Search Bar & Direct SKU Input -->
				<div class="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-sm space-y-3">
					<div class="flex gap-2">
						<div class="relative flex-1">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
								</svg>
							</div>
							<input
								id="pos-search-input"
								type="text"
								bind:value={productSearch}
								onkeydown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										if (filteredProducts.length === 1) {
											addToCart(filteredProducts[0], 1);
											productSearch = '';
										}
									}
								}}
								placeholder="Buscar producto por nombre o SKU manual..."
								class="block w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
							/>
						</div>
						{#if productSearch}
							<button
								type="button"
								onclick={() => (productSearch = '')}
								class="rounded-xl border border-slate-700 bg-slate-800 px-3 text-xs text-slate-400 hover:text-white"
							>
								Limpiar
							</button>
						{/if}
					</div>
				</div>

				<!-- Products Quick Select Grid -->
				<div class="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 backdrop-blur-sm max-h-[560px] overflow-y-auto">
					<div class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex justify-between">
						<span>Catálogo Rápido</span>
						<span>{filteredProducts.length} productos</span>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{#each filteredProducts as product (product.id)}
							<button
								type="button"
								onclick={() => addToCart(product, 1)}
								class="flex items-center gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-800/60 transition-all text-left group"
							>
								<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-400 group-hover:text-indigo-400 overflow-hidden">
									{#if product.image_url}
										<img src={product.image_url} alt={product.name} class="h-full w-full object-cover" />
									{:else}
										<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
										</svg>
									{/if}
								</div>
								<div class="flex-1 min-w-0">
									<div class="font-semibold text-sm text-slate-100 truncate group-hover:text-indigo-300">
										{product.name}
									</div>
									<div class="flex items-center justify-between text-xs mt-1">
										<span class="font-mono text-[11px] text-slate-400">{product.sku_code}</span>
										<span class="font-bold text-emerald-400 font-mono">${product.price.toFixed(2)}</span>
									</div>
								</div>
							</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- Right Column: Cart Table & Checkout (5 cols) -->
			<div class="lg:col-span-5 space-y-4">
				<CartTable
					items={cart}
					onUpdateQuantity={updateQuantity}
					onRemoveItem={removeItem}
					onClearCart={clearCart}
				/>

				<!-- Checkout Action Form -->
				<form
					method="POST"
					action="?/checkout"
					use:enhance={() => {
						submitting = true;
						return async ({ result, update }) => {
							submitting = false;
							if (result.type === 'success') {
								const resData = result.data as any;
								const totalCharged = calculateTotal(cart);
								const countCharged = cart.length;
								completedSale = {
									id: resData?.outletId ?? 'REG-OK',
									total: totalCharged,
									count: countCharged
								};
								cart = [];
								idempotencyKey = crypto.randomUUID(); // Fresh key for next operation
								showNotification('success', 'Venta cobrada con éxito.');
								await update();
							} else if (result.type === 'failure') {
								const errMessage = (result.data?.error as string) ?? 'Error al procesar el cobro.';
								if (result.data?.idempotencyKey) {
									idempotencyKey = result.data.idempotencyKey as string;
								}
								showNotification('error', errMessage);
							}
						};
					}}
				>
					<input
						type="hidden"
						name="items"
						value={JSON.stringify(
							cart.map((item) => ({
								product_id: item.id,
								quantity: item.quantity
							}))
						)}
					/>
					<input type="hidden" name="idempotency_key" value={idempotencyKey} />

					<button
						id="btn-checkout"
						type="submit"
						disabled={submitting || cart.length === 0}
						class="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-4 text-base font-bold text-white shadow-xl shadow-emerald-600/30 hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
					>
						{#if submitting}
							<svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
							</svg>
							Procesando Venta...
						{:else}
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
							</svg>
							Cobrar Venta (${calculateTotal(cart).toFixed(2)})
						{/if}
					</button>
				</form>
			</div>
		</div>
	</div>
</div>

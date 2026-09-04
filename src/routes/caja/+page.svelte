<script lang="ts">
	import { enhance } from "$app/forms";
	import BarcodeScanner from "$lib/components/caja/BarcodeScanner.svelte";
	import CartTable, {
		type CartItem,
		calculateTotal,
	} from "$lib/components/caja/CartTable.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import Button from "$lib/components/ui/Button.svelte";
	import Badge from "$lib/components/ui/Badge.svelte";
	import type { PageData, ActionData } from "./$types";
	import {
		Search,
		X,
		Package,
		CheckCircle2,
		AlertCircle,
		Info,
		Loader2,
		CreditCard,
		Sparkles,
	} from "lucide-svelte";

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let cart = $state<CartItem[]>([]);
	let idempotencyKey = $state<string>(crypto.randomUUID());
	let productSearch = $state("");
	let submitting = $state(false);
	let notification = $state<{
		type: "success" | "error" | "info";
		message: string;
	} | null>(null);
	let completedSale = $state<{
		id: string;
		total: number;
		count: number;
	} | null>(null);

	// Filter products for quick-add list
	let filteredProducts = $derived(
		(data.products ?? []).filter((p: any) => {
			if (!productSearch.trim()) return true;
			const term = productSearch.toLowerCase();
			return (
				p.name.toLowerCase().includes(term) ||
				p.sku_code.toLowerCase().includes(term)
			);
		}),
	);

	function showNotification(
		type: "success" | "error" | "info",
		message: string,
	) {
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
			updated[existingIndex].quantity =
				Math.round(
					(updated[existingIndex].quantity + qtyToAdd) * 1000,
				) / 1000;
			cart = updated;
			showNotification(
				"info",
				`+${qtyToAdd} "${product.name}" agregado al carrito.`,
			);
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
					image_url: product.image_url,
				},
			];
			showNotification(
				"success",
				`"${product.name}" agregado al carrito.`,
			);
		}
	}

	function handleBarcodeScanned(code: string) {
		const cleanCode = code.trim().toLowerCase();
		const matchedProduct = (data.products ?? []).find(
			(p: any) => p.sku_code.toLowerCase() === cleanCode,
		);

		if (matchedProduct) {
			addToCart(matchedProduct, 1);
		} else {
			showNotification(
				"error",
				`SKU "${code}" no encontrado en catálogo activo.`,
			);
		}
	}

	function updateQuantity(id: string, newQty: number) {
		cart = cart.map((item) =>
			item.id === id ? { ...item, quantity: newQty } : item,
		);
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
	<meta
		name="description"
		content="Módulo de cobro rápido con lector de código de barras USB y carrito de compras."
	/>
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto flex flex-col flex-1">
	<!-- Section Header -->
	<div
		class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5"
	>
		<div>
			<h2
				class="text-xl sm:text-2xl font-semibold tracking-tight text-foreground"
			>
				Punto de Venta
			</h2>
			<p class="text-xs sm:text-sm text-muted-foreground mt-0.5">
				Escaneo global USB y cobro atómico con auditoría automática.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<BarcodeScanner onScan={handleBarcodeScanned} />

			<Badge
				variant="secondary"
				class="gap-1.5 px-3 py-1 font-mono text-xs"
			>
				<span
					class="h-1.5 w-1.5 rounded-full {data.user?.role === 'admin'
						? 'bg-amber-400'
						: 'bg-emerald-400'}"
				></span>
				<span>Rol: {data.user?.role ?? "cajero"}</span>
			</Badge>
		</div>
	</div>

	<!-- Notification Toast / Alert -->
	{#if notification}
		<div
			role="status"
			class="rounded-lg border px-4 py-3 text-xs sm:text-sm flex items-center justify-between shadow-xs transition-all {notification.type ===
			'error'
				? 'border-destructive/30 bg-destructive/10 text-destructive dark:text-red-300'
				: notification.type === 'success'
					? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
					: 'border-border bg-accent/60 text-foreground'}"
		>
			<div class="flex items-center gap-2.5">
				{#if notification.type === "error"}
					<AlertCircle class="h-4 w-4 shrink-0" strokeWidth={2} />
				{:else if notification.type === "success"}
					<CheckCircle2 class="h-4 w-4 shrink-0" strokeWidth={2} />
				{:else}
					<Info class="h-4 w-4 shrink-0" strokeWidth={2} />
				{/if}
				<span class="font-medium">{notification.message}</span>
			</div>
			<button
				type="button"
				onclick={() => (notification = null)}
				class="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
				aria-label="Cerrar notificación"
			>
				<X class="h-3.5 w-3.5" strokeWidth={2} />
			</button>
		</div>
	{/if}

	<!-- Completed Sale Success Alert -->
	{#if completedSale}
		<div
			class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
		>
			<div class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 shrink-0"
				>
					<CheckCircle2 class="h-5 w-5" strokeWidth={2} />
				</div>
				<div>
					<h3 class="text-sm font-semibold text-foreground">
						¡Venta Registrada Exitosamente!
					</h3>
					<p class="text-xs text-muted-foreground font-mono mt-0.5">
						ID: {completedSale.id} • Total: ${completedSale.total.toFixed(
							2,
						)} ({completedSale.count} artículos)
					</p>
				</div>
			</div>
			<Button
				variant="outline"
				size="sm"
				onclick={() => (completedSale = null)}
				class="border-emerald-600/30 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300"
			>
				Nueva Venta
			</Button>
		</div>
	{/if}

	<!-- POS Layout Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1">
		<!-- Left Column: Product Search & Quick Catalog (7 cols) -->
		<div class="lg:col-span-7 space-y-4">
			<!-- Search Bar & Direct SKU Input -->
			<div
				class="bg-card p-4 rounded-lg border border-border shadow-xs space-y-3"
			>
				<div class="flex gap-2">
					<div class="relative flex-1">
						<div
							class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground"
						>
							<Search class="h-4 w-4" strokeWidth={1.5} />
						</div>
						<input
							id="pos-search-input"
							type="text"
							bind:value={productSearch}
							onkeydown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									if (filteredProducts.length === 1) {
										addToCart(filteredProducts[0], 1);
										productSearch = "";
									}
								}
							}}
							placeholder="Buscar producto por nombre o SKU manual..."
							class="flex h-10 w-full rounded-md border border-input bg-transparent pl-9 pr-4 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						/>
					</div>
					{#if productSearch}
						<Button
							type="button"
							variant="outline"
							size="default"
							onclick={() => (productSearch = "")}
							class="h-10 px-3 text-xs"
						>
							<X class="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
							Limpiar
						</Button>
					{/if}
				</div>
			</div>

			<!-- Quick Catalog Card -->
			<div
				class="bg-card p-4 rounded-lg border border-border shadow-xs max-h-[580px] flex flex-col"
			>
				<div
					class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center justify-between"
				>
					<span>Catálogo Rápido</span>
					<Badge
						variant="secondary"
						class="font-mono text-[10px] !bg-black text-white hover:!bg-black border-none select-none"
					>
						{filteredProducts.length} productos
					</Badge>
				</div>

				<div
					class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto pr-1"
				>
					{#each filteredProducts as product (product.id)}
						<button
							type="button"
							onclick={() => addToCart(product, 1)}
							class="flex items-center gap-3 p-2.5 rounded-md border border-border bg-card hover:bg-accent hover:border-slate-400 dark:hover:border-slate-700 transition-all text-left group shadow-xs cursor-pointer"
						>
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground border border-border group-hover:text-foreground overflow-hidden"
							>
								{#if product.image_url}
									<img
										src={product.image_url}
										alt={product.name}
										class="h-full w-full object-cover"
									/>
								{:else}
									<Package
										class="h-5 w-5"
										strokeWidth={1.5}
									/>
								{/if}
							</div>
							<div class="flex-1 min-w-0">
								<div
									class="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors"
								>
									{product.name}
								</div>
								<div
									class="flex items-center justify-between text-xs mt-1"
								>
									<span
										class="font-mono text-[11px] text-muted-foreground"
										>{product.sku_code}</span
									>
									<span
										class="font-mono font-semibold text-foreground tabular-nums"
										>${product.price.toFixed(2)}</span
									>
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
						if (result.type === "success") {
							const resData = result.data as any;
							const totalCharged = calculateTotal(cart);
							const countCharged = cart.length;
							completedSale = {
								id: resData?.outletId ?? "REG-OK",
								total: totalCharged,
								count: countCharged,
							};
							cart = [];
							idempotencyKey = crypto.randomUUID(); // Fresh key for next operation
							showNotification(
								"success",
								"Venta cobrada con éxito.",
							);
							await update();
						} else if (result.type === "failure") {
							const errMessage =
								(result.data?.error as string) ??
								"Error al procesar el cobro.";
							if (result.data?.idempotencyKey) {
								idempotencyKey = result.data
									.idempotencyKey as string;
							}
							showNotification("error", errMessage);
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
							quantity: item.quantity,
						})),
					)}
				/>
				<input
					type="hidden"
					name="idempotency_key"
					value={idempotencyKey}
				/>

				<button
					id="btn-checkout"
					type="submit"
					disabled={submitting || cart.length === 0}
					class="w-full flex items-center justify-center gap-2 rounded-lg bg-black text-white px-6 py-3 text-sm font-medium shadow-sm hover:bg-black/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer select-none border border-transparent"
				>
					{#if submitting}
						<Loader2
							class="h-4 w-4 animate-spin text-white"
							strokeWidth={2}
						/>
						<span>Procesando Venta...</span>
					{:else}
						<CreditCard
							class="h-4 w-4 text-white"
							strokeWidth={1.5}
						/>
						<span
							>Cobrar Venta (${calculateTotal(cart).toFixed(
								2,
							)})</span
						>
					{/if}
				</button>
			</form>
		</div>
	</div>
</div>

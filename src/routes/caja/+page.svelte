<script lang="ts">
	import { enhance } from "$app/forms";
	import BarcodeScanner from "$lib/components/caja/BarcodeScanner.svelte";
	import CartTable, {
		type CartItem,
		type PaymentMethod,
		calculateTotal,
		calculatePayment,
		validateAndRestoreCart,
		getCartStorageKey,
		pruneStaleCartSessions,
		formatStock,
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
		Banknote,
		Split,
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
		paymentMethod?: string;
		cashReceived?: number;
		changeAmount?: number;
		cardAmount?: number;
	} | null>(null);

	// Estado para formas de pago
	let selectedPaymentMethod = $state<PaymentMethod>("EFECTIVO");
	let cashReceivedInput = $state<string>("");
	let cardAmountInput = $state<string>("");

	let storageKey = $derived(getCartStorageKey(data.user?.id, (data as any).sessionId));

	// Hidratación en montaje del componente desde sessionStorage con aislamiento de sesión
	$effect(() => {
		if (typeof window !== "undefined" && window.sessionStorage) {
			pruneStaleCartSessions(storageKey);
			const saved = window.sessionStorage.getItem(storageKey);
			if (saved && cart.length === 0) {
				const restored = validateAndRestoreCart(saved, data.products ?? []);
				if (restored.length > 0) {
					cart = restored;
				}
			}
		}
	});

	// Persistencia reactiva cada vez que cart cambia
	$effect(() => {
		if (typeof window !== "undefined" && window.sessionStorage) {
			if (cart.length > 0) {
				window.sessionStorage.setItem(storageKey, JSON.stringify(cart));
			} else {
				window.sessionStorage.removeItem(storageKey);
			}
		}
	});

	let totalAmount = $derived(calculateTotal(cart));
	let paymentCalc = $derived(
		calculatePayment(totalAmount, selectedPaymentMethod, {
			cashReceived: cashReceivedInput,
			cardAmount: cardAmountInput,
		})
	);

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
		if (product.stock <= 0) {
			showNotification(
				"error",
				`"${product.name}" está agotado (stock 0).`,
			);
			return;
		}

		const existingIndex = cart.findIndex((item) => item.id === product.id);
		const maxStock = Math.floor(product.stock);

		if (existingIndex >= 0) {
			const currentQty = cart[existingIndex].quantity;
			if (currentQty >= maxStock) {
				showNotification(
					"error",
					`No es posible agregar más unidades de "${product.name}". Stock máximo disponible alcanzado (${maxStock}).`,
				);
				return;
			}
			const newQty = Math.min(maxStock, currentQty + qtyToAdd);
			const updated = [...cart];
			updated[existingIndex].quantity = newQty;
			cart = updated;
			showNotification(
				"info",
				`+${newQty - currentQty} "${product.name}" agregado al carrito.`,
			);
		} else {
			const initialQty = Math.min(maxStock, Math.max(1, qtyToAdd));
			cart = [
				...cart,
				{
					id: product.id,
					sku_code: product.sku_code,
					name: product.name,
					price: product.price,
					stock: product.stock,
					quantity: initialQty,
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
			if (matchedProduct.stock <= 0) {
				showNotification(
					"error",
					`SKU "${code}" (${matchedProduct.name}) está agotado (stock 0).`,
				);
				return;
			}
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
		cashReceivedInput = "";
		cardAmountInput = "";
		if (typeof window !== "undefined" && window.sessionStorage) {
			window.sessionStorage.removeItem(storageKey);
		}
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
			<h1
				class="text-xl sm:text-2xl font-semibold tracking-tight text-foreground"
			>
				Punto de Venta (Caja)
			</h1>
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
						ID Salida: {completedSale.id} • Total: ${completedSale.total.toFixed(
							2,
						)} ({completedSale.count} artículos)
						{#if completedSale.paymentMethod}
							• {completedSale.paymentMethod}
						{/if}
						{#if completedSale.paymentMethod === 'EFECTIVO'}
							• Recibido: ${(completedSale.cashReceived ?? completedSale.total).toFixed(2)} • Cambio: ${(completedSale.changeAmount ?? 0).toFixed(2)}
						{:else if completedSale.paymentMethod === 'TARJETA'}
							• Tarjeta: ${(completedSale.cardAmount ?? completedSale.total).toFixed(2)}
						{:else if completedSale.paymentMethod === 'MIXTO'}
							• Tarjeta: ${(completedSale.cardAmount ?? 0).toFixed(2)} • Recibido: ${(completedSale.cashReceived ?? 0).toFixed(2)} • Cambio: ${(completedSale.changeAmount ?? 0).toFixed(2)}
						{/if}
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
						{@const isOutOfStock = product.stock <= 0}
						{@const isLowStock = product.stock > 0 && product.stock <= product.min_stock}
						<button
							type="button"
							disabled={isOutOfStock}
							onclick={() => addToCart(product, 1)}
							class="flex items-center gap-3 p-2.5 rounded-md border border-border bg-card hover:bg-accent hover:border-slate-400 dark:hover:border-slate-700 transition-all text-left group shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-card"
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
								<div class="flex items-center justify-between gap-1">
									<span class="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
										{product.name}
									</span>
									{#if isOutOfStock}
										<span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
											Agotado
										</span>
									{:else if isLowStock}
										<span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
											Bajo stock
										</span>
									{/if}
								</div>
								<div
									class="flex items-center justify-between text-xs mt-1"
								>
									<div class="flex items-center gap-1.5 min-w-0">
										<span class="font-mono text-[11px] text-muted-foreground">{product.sku_code}</span>
										<span class="text-[11px] text-muted-foreground">• Stock: {formatStock(product.stock)}</span>
									</div>
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

			<!-- Formas de Pago Card -->
			<div class="bg-card p-4 rounded-lg border border-border shadow-xs space-y-4">
				<div class="flex items-center justify-between">
					<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Forma de Pago</span>
					<Badge variant="outline" class="font-mono text-[11px] uppercase">
						{selectedPaymentMethod}
					</Badge>
				</div>

				<!-- Selector Buttons -->
				<div class="grid grid-cols-3 gap-2">
					<button
						type="button"
						id="payment-method-cash"
						onclick={() => { selectedPaymentMethod = 'EFECTIVO'; }}
						class="flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer {selectedPaymentMethod === 'EFECTIVO' ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary' : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
					>
						<Banknote class="h-4 w-4 mb-1" strokeWidth={1.5} />
						<span>Efectivo</span>
					</button>

					<button
						type="button"
						id="payment-method-card"
						onclick={() => { selectedPaymentMethod = 'TARJETA'; }}
						class="flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer {selectedPaymentMethod === 'TARJETA' ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary' : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
					>
						<CreditCard class="h-4 w-4 mb-1" strokeWidth={1.5} />
						<span>Tarjeta</span>
					</button>

					<button
						type="button"
						id="payment-method-mixed"
						onclick={() => {
							selectedPaymentMethod = 'MIXTO';
							if (!cardAmountInput && totalAmount > 0) {
								cardAmountInput = (Math.round((totalAmount / 2) * 100) / 100).toFixed(2);
							}
						}}
						class="flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer {selectedPaymentMethod === 'MIXTO' ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary' : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
					>
						<Split class="h-4 w-4 mb-1" strokeWidth={1.5} />
						<span>Mixto</span>
					</button>
				</div>

				<!-- Campos dinámicos según selección -->
				{#if selectedPaymentMethod === 'EFECTIVO'}
					<div class="space-y-3 pt-1 border-t border-border/60">
						<div>
							<div class="flex justify-between items-center mb-1">
								<label for="input-cash-received" class="text-xs font-medium text-foreground">
									Efectivo Recibido
								</label>
								<span class="text-[11px] text-muted-foreground">Total: ${totalAmount.toFixed(2)}</span>
							</div>
							<div class="relative">
								<span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground font-mono text-sm">$</span>
								<input
									id="input-cash-received"
									type="number"
									step="0.5"
									min="0"
									bind:value={cashReceivedInput}
									placeholder={totalAmount.toFixed(2)}
									class="flex h-10 w-full rounded-md border border-input bg-transparent pl-7 pr-3 py-2 text-sm font-mono shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
								/>
							</div>
						</div>

						<!-- Botones rápidos de denominaciones -->
						<div class="flex flex-wrap gap-1.5 pt-0.5">
							<button
								type="button"
								onclick={() => { cashReceivedInput = totalAmount.toFixed(2); }}
								class="px-2 py-1 text-[11px] rounded bg-muted hover:bg-accent border border-border text-foreground transition-colors cursor-pointer"
							>
								Exacto (${totalAmount.toFixed(2)})
							</button>
							{#each [50, 100, 200, 500, 1000] as bill}
								{#if bill >= totalAmount}
									<button
										type="button"
										onclick={() => { cashReceivedInput = bill.toFixed(2); }}
										class="px-2 py-1 text-[11px] rounded bg-muted hover:bg-accent border border-border text-foreground transition-colors cursor-pointer"
									>
										${bill}
									</button>
								{/if}
							{/each}
						</div>

						<!-- Desglose de cambio -->
						{#if paymentCalc.valid}
							<div class="flex justify-between items-center p-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
								<span class="font-medium text-emerald-900 dark:text-emerald-200">Cambio:</span>
								<span class="font-mono font-bold text-base text-emerald-700 dark:text-emerald-300 tabular-nums">
									${paymentCalc.changeAmount.toFixed(2)}
								</span>
							</div>
						{:else if cashReceivedInput}
							<div class="text-xs text-amber-600 dark:text-amber-400 font-medium">
								{paymentCalc.error}
							</div>
						{/if}
					</div>

				{:else if selectedPaymentMethod === 'TARJETA'}
					<div class="space-y-2 pt-1 border-t border-border/60">
						<div class="p-3 rounded-md bg-muted/40 border border-border text-xs space-y-1.5">
							<div class="flex justify-between items-center">
								<span class="text-muted-foreground">Cobro en Terminal:</span>
								<span class="font-mono font-bold text-sm text-foreground tabular-nums">${totalAmount.toFixed(2)}</span>
							</div>
							<div class="flex justify-between items-center text-muted-foreground text-[11px]">
								<span>Cambio:</span>
								<span class="font-mono">$0.00 (No aplica)</span>
							</div>
						</div>
					</div>

				{:else if selectedPaymentMethod === 'MIXTO'}
					<div class="space-y-3 pt-1 border-t border-border/60">
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
							<div>
								<label for="input-card-amount" class="text-xs font-medium text-foreground block mb-1">
									Tarjeta
								</label>
								<div class="relative">
									<span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground font-mono text-xs">$</span>
									<input
										id="input-card-amount"
										type="number"
										step="0.01"
										min="0.01"
										max={totalAmount}
										bind:value={cardAmountInput}
										placeholder="0.00"
										class="flex h-9 w-full rounded-md border border-input bg-transparent pl-6 pr-2 py-1 text-xs font-mono shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
									/>
								</div>
							</div>

							<div>
								<label for="input-mixed-cash-received" class="text-xs font-medium text-foreground block mb-1">
									Efectivo Recibido
								</label>
								<div class="relative">
									<span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground font-mono text-xs">$</span>
									<input
										id="input-mixed-cash-received"
										type="number"
										step="0.5"
										min="0"
										bind:value={cashReceivedInput}
										placeholder={(Math.max(0, totalAmount - (Number(cardAmountInput) || 0))).toFixed(2)}
										class="flex h-9 w-full rounded-md border border-input bg-transparent pl-6 pr-2 py-1 text-xs font-mono shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
									/>
								</div>
							</div>
						</div>

						<div class="p-2.5 rounded-md bg-muted/40 border border-border text-xs space-y-1">
							<div class="flex justify-between text-muted-foreground">
								<span>Efectivo requerido:</span>
								<span class="font-mono font-medium text-foreground tabular-nums">
									${paymentCalc.cashAmount.toFixed(2)}
								</span>
							</div>
							{#if paymentCalc.valid}
								<div class="flex justify-between items-center pt-1 border-t border-border/40 text-emerald-700 dark:text-emerald-300">
									<span class="font-medium">Cambio:</span>
									<span class="font-mono font-bold text-sm tabular-nums">
										${paymentCalc.changeAmount.toFixed(2)}
									</span>
								</div>
							{:else if cardAmountInput || cashReceivedInput}
								<div class="text-[11px] text-amber-600 dark:text-amber-400 font-medium pt-1">
									{paymentCalc.error}
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>

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
								paymentMethod: selectedPaymentMethod,
								cashReceived: resData?.cashReceived ?? paymentCalc.cashReceived,
								changeAmount: resData?.changeAmount ?? paymentCalc.changeAmount,
								cardAmount: resData?.cardAmount ?? paymentCalc.cardAmount
							};
							cart = [];
							cashReceivedInput = "";
							cardAmountInput = "";
							if (typeof window !== "undefined" && window.sessionStorage) {
								window.sessionStorage.removeItem(storageKey);
							}
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
				<input
					type="hidden"
					name="payment_method"
					value={selectedPaymentMethod}
				/>
				<input
					type="hidden"
					name="cash_amount"
					value={paymentCalc.cashAmount}
				/>
				<input
					type="hidden"
					name="card_amount"
					value={paymentCalc.cardAmount}
				/>
				<input
					type="hidden"
					name="cash_received"
					value={paymentCalc.cashReceived}
				/>
				<input
					type="hidden"
					name="change_amount"
					value={paymentCalc.changeAmount}
				/>

				<button
					id="btn-checkout"
					type="submit"
					disabled={submitting || cart.length === 0 || !paymentCalc.valid}
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
						<span>
							{#if selectedPaymentMethod === 'EFECTIVO'}
								Cobrar Venta en Efectivo (${totalAmount.toFixed(2)})
							{:else if selectedPaymentMethod === 'TARJETA'}
								Cobrar Venta con Tarjeta (${totalAmount.toFixed(2)})
							{:else}
								Cobrar Venta Mixta (${totalAmount.toFixed(2)})
							{/if}
						</span>
					{/if}
				</button>
			</form>
		</div>
	</div>
</div>

<script lang="ts">
	import { enhance } from '$app/forms';
	import ProductModal, { type ProductData } from '$lib/components/admin/ProductModal.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state(data.search ?? '');
	let modalOpen = $state(false);
	let selectedProduct = $state<ProductData | null>(null);

	// Client-side filtering in case user types without pressing Enter
	let filteredProducts = $derived(
		(data.products ?? []).filter((p: any) => {
			if (!searchQuery.trim()) return true;
			const term = searchQuery.toLowerCase();
			return p.name.toLowerCase().includes(term) || p.sku_code.toLowerCase().includes(term);
		})
	);

	function openCreateModal() {
		selectedProduct = null;
		modalOpen = true;
	}

	function openEditModal(product: any) {
		selectedProduct = { ...product };
		modalOpen = true;
	}

	function closeModal() {
		modalOpen = false;
		selectedProduct = null;
	}
</script>

<svelte:head>
	<title>Catálogo de Productos — Administración</title>
	<meta name="description" content="Gestión del catálogo de productos y costos para administradores." />
</svelte:head>

<div class="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
	<div class="max-w-7xl mx-auto space-y-6">
		<!-- Header -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
			<div>
				<div class="flex items-center gap-2">
					<span class="inline-flex items-center rounded-md bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
						Módulo Admin
					</span>
					<span class="text-xs text-slate-500">•</span>
					<span class="text-xs text-slate-400">Total: {data.products.length} productos activos</span>
				</div>
				<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">Catálogo de Productos</h1>
				<p class="text-sm text-slate-400 mt-1">Alta, edición, control de inventario y gestión de costos confidenciales.</p>
			</div>

			<button
				id="btn-create-product"
				type="button"
				onclick={openCreateModal}
				class="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 transition-all"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				Nuevo Producto
			</button>
		</div>

		<!-- Search & Filter Bar -->
		<div class="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-sm">
			<form method="GET" class="relative w-full sm:w-96">
				<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
				</div>
				<input
					id="search-input"
					name="q"
					type="text"
					bind:value={searchQuery}
					placeholder="Buscar por nombre o código SKU..."
					class="block w-full rounded-lg border border-slate-700 bg-slate-950/90 pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				/>
			</form>

			<div class="flex items-center gap-2 text-xs text-slate-400">
				<span class="flex h-2 w-2 rounded-full bg-emerald-500"></span>
				Mostrando {filteredProducts.length} de {data.products.length} productos
			</div>
		</div>

		<!-- Products Table -->
		<div class="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 shadow-xl backdrop-blur-sm">
			<div class="overflow-x-auto">
				<table class="w-full text-left text-sm text-slate-300">
					<thead class="bg-slate-900/90 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
						<tr>
							<th scope="col" class="px-4 py-3.5">Producto</th>
							<th scope="col" class="px-4 py-3.5">SKU</th>
							<th scope="col" class="px-4 py-3.5 text-right">Precio Venta</th>
							<th scope="col" class="px-4 py-3.5 text-right">
								<span class="text-amber-400 flex items-center justify-end gap-1">
									<svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
										<path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
									</svg>
									Costo (Admin)
								</span>
							</th>
							<th scope="col" class="px-4 py-3.5 text-center">Stock / Mínimo</th>
							<th scope="col" class="px-4 py-3.5 text-center">Estado</th>
							<th scope="col" class="px-4 py-3.5 text-right">Acciones</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-800/60">
						{#if filteredProducts.length === 0}
							<tr>
								<td colspan="7" class="px-6 py-12 text-center text-slate-500">
									<div class="flex flex-col items-center justify-center gap-2">
										<svg class="h-10 w-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
										</svg>
										<p class="font-medium text-slate-400">No se encontraron productos</p>
										<p class="text-xs text-slate-500">Intente con otro término de búsqueda o agregue un nuevo producto.</p>
									</div>
								</td>
							</tr>
						{:else}
							{#each filteredProducts as product (product.id)}
								{@const isLowStock = product.stock <= product.min_stock}
								<tr class="hover:bg-slate-800/40 transition-colors">
									<!-- Product Name & Thumbnail -->
									<td class="px-4 py-3.5">
										<div class="flex items-center gap-3">
											<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800 border border-slate-700/80 overflow-hidden text-slate-400">
												{#if product.image_url}
													<img src={product.image_url} alt={product.name} class="h-full w-full object-cover" />
												{:else}
													<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
													</svg>
												{/if}
											</div>
											<div>
												<div class="font-semibold text-slate-100">{product.name}</div>
												{#if product.description}
													<div class="text-xs text-slate-400 line-clamp-1">{product.description}</div>
												{/if}
											</div>
										</div>
									</td>

									<!-- SKU -->
									<td class="px-4 py-3.5 font-mono text-xs text-slate-300">
										<span class="inline-flex items-center rounded-md bg-slate-800 px-2 py-1 font-mono text-xs text-slate-300 ring-1 ring-inset ring-slate-700">
											{product.sku_code}
										</span>
									</td>

									<!-- Price -->
									<td class="px-4 py-3.5 text-right font-semibold text-slate-100">
										${product.price.toFixed(2)}
									</td>

									<!-- Cost (Admin) -->
									<td class="px-4 py-3.5 text-right font-mono text-xs text-amber-300">
										${product.cost.toFixed(2)}
									</td>

									<!-- Stock / Min Stock -->
									<td class="px-4 py-3.5 text-center">
										<div class="flex flex-col items-center gap-1">
											<span
												class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium {isLowStock
													? 'bg-amber-950/80 text-amber-300 ring-1 ring-amber-500/50'
													: 'bg-emerald-950/80 text-emerald-300 ring-1 ring-emerald-500/50'}"
											>
												{#if isLowStock}
													<svg class="h-3 w-3 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
														<path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
													</svg>
												{/if}
												{product.stock.toFixed(3)}
											</span>
											<span class="text-[10px] text-slate-500">Mín: {product.min_stock.toFixed(3)}</span>
										</div>
									</td>

									<!-- Status -->
									<td class="px-4 py-3.5 text-center">
										<span class="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
											Activo
										</span>
									</td>

									<!-- Actions -->
									<td class="px-4 py-3.5 text-right space-x-2">
										<button
											type="button"
											onclick={() => openEditModal(product)}
											class="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
										>
											<svg class="h-3.5 w-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
											</svg>
											Editar
										</button>

										<!-- Soft Delete Form -->
										<form
											method="POST"
											action="?/softDelete"
											use:enhance={() => {
												return async ({ update }) => {
													await update();
												};
											}}
											class="inline-block"
											onsubmit={(e) => {
												if (!confirm(`¿Está seguro de desactivar el producto "${product.name}"?`)) {
													e.preventDefault();
												}
											}}
										>
											<input type="hidden" name="id" value={product.id} />
											<button
												type="submit"
												class="inline-flex items-center gap-1 rounded-lg bg-red-950/40 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-900/60 hover:text-red-300 ring-1 ring-red-500/30 transition-colors"
											>
												<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
												</svg>
												Desactivar
											</button>
										</form>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Reusable Modal -->
		<ProductModal
			isOpen={modalOpen}
			product={selectedProduct}
			onClose={closeModal}
		/>
	</div>
</div>

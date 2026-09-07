<script lang="ts">
	import { enhance } from "$app/forms";
	import ProductModal, {
		type ProductData,
	} from "$lib/components/admin/ProductModal.svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let searchQuery = $state(data.search ?? "");
	let modalOpen = $state(false);
	let selectedProduct = $state<ProductData | null>(null);

	// Client-side filtering in case user types without pressing Enter
	let filteredProducts = $derived(
		(data.products ?? []).filter((p: any) => {
			if (!searchQuery.trim()) return true;
			const term = searchQuery.toLowerCase();
			return (
				p.name.toLowerCase().includes(term) ||
				p.sku_code.toLowerCase().includes(term)
			);
		}),
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
	<meta
		name="description"
		content="Gestión del catálogo de productos y costos para administradores."
	/>
</svelte:head>

<div class="min-h-screen bg-slate-50/50 text-slate-900 p-4 sm:p-6 lg:p-8">
	<div class="max-w-7xl mx-auto space-y-6">
		<!-- Header -->
		<div
			class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5"
		>
			<div>
				<div class="flex items-center gap-2">
					<span
						class="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200"
					>
						Módulo Admin
					</span>
					<span class="text-xs text-slate-400">•</span>
					<span class="text-xs text-slate-500 font-medium"
						>Total: {data.products.length} productos activos</span
					>
				</div>
				<h1
					class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1"
				>
					Catálogo de Productos
				</h1>
				<p class="text-sm text-slate-500 mt-1">
					Alta, edición, control de inventario y gestión de costos
					confidenciales.
				</p>
			</div>

			<!-- Header Actions -->
			<div class="flex items-center gap-3">
				<a
					id="btn-export-csv"
					href="/admin/productos/export"
					download
					class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 transition-all cursor-pointer"
				>
					<svg class="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
					</svg>
					Exportar CSV
				</a>

				<button
					id="btn-create-product"
					type="button"
					onclick={openCreateModal}
					class="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-black/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-all cursor-pointer"
				>
					<svg
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4v16m8-8H4"
						/>
					</svg>
					Nuevo Producto
				</button>
			</div>
		</div>

		<!-- Search & Filter Bar -->
		<div
			class="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm"
		>
			<form method="GET" class="relative w-full sm:w-96">
				<div
					class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400"
				>
					<svg
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
				</div>
				<input
					id="search-input"
					name="q"
					type="text"
					bind:value={searchQuery}
					placeholder="Buscar por nombre o código SKU..."
					class="block w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
				/>
			</form>

			<div
				class="flex items-center gap-2 text-xs text-slate-500 font-medium"
			>
				<span class="flex h-2 w-2 rounded-full bg-emerald-500"></span>
				Mostrando {filteredProducts.length} de {data.products.length} productos
			</div>
		</div>

		<!-- Products Table -->
		<div
			class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
		>
			<div class="overflow-x-auto">
				<table class="w-full text-left text-sm text-slate-700">
					<thead
						class="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200"
					>
						<tr>
							<th scope="col" class="px-4 py-3.5 font-semibold"
								>Producto</th
							>
							<th scope="col" class="px-4 py-3.5 font-semibold"
								>SKU</th
							>
							<th
								scope="col"
								class="px-4 py-3.5 text-right font-semibold"
								>Precio Venta</th
							>
							<th
								scope="col"
								class="px-4 py-3.5 text-right font-semibold"
							>
								<span
									class="text-amber-700 flex items-center justify-end gap-1"
								>
									<svg
										class="h-3.5 w-3.5"
										viewBox="0 0 20 20"
										fill="currentColor"
									>
										<path
											fill-rule="evenodd"
											d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
											clip-rule="evenodd"
										/>
									</svg>
									Costo (Admin)
								</span>
							</th>
							<th
								scope="col"
								class="px-4 py-3.5 text-center font-semibold"
								>Stock / Mínimo</th
							>
							<th
								scope="col"
								class="px-4 py-3.5 text-center font-semibold"
								>Estado</th
							>
							<th
								scope="col"
								class="px-4 py-3.5 text-right font-semibold"
								>Acciones</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#if filteredProducts.length === 0}
							<tr>
								<td
									colspan="7"
									class="px-6 py-12 text-center text-slate-500"
								>
									<div
										class="flex flex-col items-center justify-center gap-2"
									>
										<svg
											class="h-10 w-10 text-slate-300"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="1.5"
												d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
											/>
										</svg>
										<p class="font-medium text-slate-900">
											No se encontraron productos
										</p>
										<p class="text-xs text-slate-500">
											Intente con otro término de búsqueda
											o agregue un nuevo producto.
										</p>
									</div>
								</td>
							</tr>
						{:else}
							{#each filteredProducts as product (product.id)}
								{@const isLowStock =
									product.stock <= product.min_stock}
								<tr
									class="hover:bg-slate-50/60 transition-colors"
								>
									<!-- Product Name & Thumbnail -->
									<td class="px-4 py-3.5">
										<div class="flex items-center gap-3">
											<div
												class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 overflow-hidden text-slate-400"
											>
												{#if product.image_url}
													<img
														src={product.image_url}
														alt={product.name}
														class="h-full w-full object-cover"
													/>
												{:else}
													<svg
														class="h-5 w-5 text-slate-400"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="1.5"
															d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
														/>
													</svg>
												{/if}
											</div>
											<div>
												<div
													class="font-semibold text-slate-900"
												>
													{product.name}
												</div>
												{#if product.description}
													<div
														class="text-xs text-slate-500 line-clamp-1"
													>
														{product.description}
													</div>
												{/if}
											</div>
										</div>
									</td>

									<!-- SKU -->
									<td
										class="px-4 py-3.5 font-mono text-xs text-slate-600"
									>
										<span
											class="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 border border-slate-200"
										>
											{product.sku_code}
										</span>
									</td>

									<!-- Price -->
									<td
										class="px-4 py-3.5 text-right font-semibold text-slate-900"
									>
										${product.price.toFixed(2)}
									</td>

									<!-- Cost (Admin) -->
									<td
										class="px-4 py-3.5 text-right font-mono text-xs font-semibold text-amber-700"
									>
										${product.cost.toFixed(2)}
									</td>

									<!-- Stock / Min Stock -->
									<td class="px-4 py-3.5 text-center">
										<div
											class="flex flex-col items-center gap-1"
										>
											<span
												class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border {isLowStock
													? 'bg-amber-50 text-amber-800 border-amber-200'
													: 'bg-emerald-50 text-emerald-800 border-emerald-200'}"
											>
												{#if isLowStock}
													<svg
														class="h-3 w-3 text-amber-600"
														viewBox="0 0 20 20"
														fill="currentColor"
													>
														<path
															fill-rule="evenodd"
															d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
															clip-rule="evenodd"
														/>
													</svg>
												{/if}
												{product.stock.toFixed(3)}
											</span>
											<span
												class="text-[10px] text-slate-400"
												>Mín: {product.min_stock.toFixed(
													3,
												)}</span
											>
										</div>
									</td>

									<!-- Status -->
									<td class="px-4 py-3.5 text-center">
										<span
											class="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200"
										>
											Activo
										</span>
									</td>

									<!-- Actions -->
									<td
										class="px-4 py-3.5 text-right space-x-2"
									>
										<button
											type="button"
											onclick={() =>
												openEditModal(product)}
											class="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-sm transition-colors cursor-pointer"
										>
											<svg
												class="h-3.5 w-3.5 text-slate-500"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
												/>
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
												if (
													!confirm(
														`¿Está seguro de desactivar el producto "${product.name}"?`,
													)
												) {
													e.preventDefault();
												}
											}}
										>
											<input
												type="hidden"
												name="id"
												value={product.id}
											/>
											<button
												type="submit"
												class="inline-flex items-center gap-1 rounded-md bg-red-50 border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 hover:text-red-700 shadow-sm transition-colors cursor-pointer"
											>
												<svg
													class="h-3.5 w-3.5"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
													/>
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

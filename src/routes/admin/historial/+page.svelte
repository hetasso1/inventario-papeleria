<script lang="ts">
	import { enhance } from "$app/forms";
	import type { PageData, ActionData } from "./$types";

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let filterStatus = $state<"all" | "active" | "canceled">("all");
	let searchQuery = $state("");

	// Modals state
	let selectedOutletForDetail = $state<any | null>(null);
	let selectedOutletForCancel = $state<any | null>(null);
	let cancelReason = $state("");
	let canceling = $state(false);

	let filteredOutlets = $derived(
		(data.outlets ?? []).filter((outlet: any) => {
			// Status filter
			if (filterStatus === "active" && outlet.is_canceled) return false;
			if (filterStatus === "canceled" && !outlet.is_canceled)
				return false;

			// Search filter (by Folio, ID, reason, or SKU in items)
			if (!searchQuery.trim()) return true;
			const term = searchQuery.toLowerCase();
			const matchFolio = outlet.folio != null && String(outlet.folio).includes(term);
			const matchId = outlet.id.toLowerCase().includes(term);
			const matchReason = outlet.cancel_reason
				?.toLowerCase()
				.includes(term);
			const matchItem = outlet.items?.some(
				(i: any) =>
					i.product_name.toLowerCase().includes(term) ||
					i.sku_code.toLowerCase().includes(term),
			);
			return matchFolio || matchId || matchReason || matchItem;
		}),
	);

	function openDetailModal(outlet: any) {
		selectedOutletForDetail = outlet;
	}

	function closeDetailModal() {
		selectedOutletForDetail = null;
	}

	function openCancelModal(outlet: any) {
		selectedOutletForCancel = outlet;
		cancelReason = "";
	}

	function closeCancelModal() {
		selectedOutletForCancel = null;
		cancelReason = "";
	}

	function formatDate(dateStr: string) {
		if (!dateStr) return "N/A";
		const d = new Date(dateStr);
		return d.toLocaleString("es-MX", {
			year: "numeric",
			month: "short",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
	}
</script>

<svelte:head>
	<title>Historial de Ventas y Devoluciones — Administración</title>
	<meta
		name="description"
		content="Consulta de salidas de inventario, detalle de artículos y devoluciones/cancelaciones de ventas."
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
						>Total: {data.outlets.length} registros de venta</span
					>
				</div>
				<h1
					class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1"
				>
					Historial de Ventas y Devoluciones
				</h1>
				<p class="text-sm text-slate-500 mt-1">
					Supervisión de salidas de almacén, revisión de tickets y
					cancelación autorizada de ventas.
				</p>
			</div>

			<div class="flex items-center gap-3">
				<a
					href="/admin/auditoria"
					class="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm cursor-pointer"
				>
					<svg
						class="h-4 w-4 text-slate-500"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
						/>
					</svg>
					Ver Auditoría de Stock
				</a>
			</div>
		</div>

		<!-- Notification Banner -->
		{#if form?.error}
			<div
				role="alert"
				class="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center justify-between shadow-sm"
			>
				<div class="flex items-center gap-2.5">
					<svg
						class="h-5 w-5 text-red-600 flex-shrink-0"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
							clip-rule="evenodd"
						/>
					</svg>
					<span>{form.error}</span>
				</div>
			</div>
		{:else if form?.success}
			<div
				role="status"
				class="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex items-center justify-between shadow-sm"
			>
				<div class="flex items-center gap-2.5">
					<svg
						class="h-5 w-5 text-emerald-600 flex-shrink-0"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
							clip-rule="evenodd"
						/>
					</svg>
					<span
						>Venta cancelada y stock restituido correctamente con
						registro de auditoría.</span
					>
				</div>
			</div>
		{/if}

		<!-- Metrics Cards -->
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
			<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
				<span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Ventas Válidas</span>
				<div class="text-2xl font-bold text-emerald-600">
					{data.metrics?.validSalesCount ?? data.outlets.filter((o: any) => !o.is_canceled).length}
				</div>
				<p class="text-[11px] text-slate-400">Transacciones activas en el período</p>
			</div>

			<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
				<span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Ingresos del Período</span>
				<div class="text-2xl font-bold text-slate-900">
					${(data.metrics?.totalRevenue ?? 0).toFixed(2)}
				</div>
				<p class="text-[11px] text-slate-400">Suma total de ventas no canceladas</p>
			</div>

			<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
				<span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Ventas Canceladas</span>
				<div class="text-2xl font-bold text-red-600">
					{data.metrics?.canceledSalesCount ?? data.outlets.filter((o: any) => o.is_canceled).length}
				</div>
				<p class="text-[11px] text-slate-400">Devoluciones supervisadas</p>
			</div>
		</div>

		<!-- Date Filter Bar -->
		<form method="GET" class="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
			<div class="flex items-center gap-2">
				<span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Período:</span>
				<a
					href="?hoy=true"
					class="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 transition-colors {data.filters?.hoy ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-slate-700 hover:bg-slate-100'}"
				>
					Hoy
				</a>
			</div>

			<div class="flex items-center gap-2">
				<label for="filter-desde" class="text-xs text-slate-500 font-medium">Desde:</label>
				<input
					id="filter-desde"
					type="date"
					name="desde"
					value={data.filters?.desde ?? ''}
					class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-900 shadow-xs focus:outline-none focus:ring-1 focus:ring-black"
				/>
			</div>

			<div class="flex items-center gap-2">
				<label for="filter-hasta" class="text-xs text-slate-500 font-medium">Hasta:</label>
				<input
					id="filter-hasta"
					type="date"
					name="hasta"
					value={data.filters?.hasta ?? ''}
					class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-900 shadow-xs focus:outline-none focus:ring-1 focus:ring-black"
				/>
			</div>

			<button
				type="submit"
				class="px-3 py-1.5 rounded-lg bg-black text-white text-xs font-medium hover:bg-black/90 transition-colors cursor-pointer"
			>
				Filtrar
			</button>

			{#if data.filters?.fecha || data.filters?.desde || data.filters?.hasta || data.filters?.hoy}
				<a
					href="/admin/historial"
					class="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
				>
					Limpiar Filtros
				</a>
			{/if}
		</form>

		<!-- Filters & Search -->
		<div
			class="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm"
		>
			<div class="relative w-full sm:w-96">
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
					id="history-search-input"
					type="text"
					bind:value={searchQuery}
					placeholder="Buscar por ID de salida, producto o motivo..."
					class="block w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
				/>
			</div>

			<!-- Tabs de Filtro Shadcn -->
			<div
				class="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200"
			>
				<button
					type="button"
					onclick={() => (filterStatus = "all")}
					class="px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer {filterStatus ===
					'all'
						? 'bg-white text-slate-900 shadow-xs'
						: 'text-slate-600 hover:text-slate-900'}"
				>
					Todas ({data.outlets.length})
				</button>
				<button
					type="button"
					onclick={() => (filterStatus = "active")}
					class="px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer {filterStatus ===
					'active'
						? 'bg-white text-emerald-700 shadow-xs'
						: 'text-slate-600 hover:text-slate-900'}"
				>
					Activas ({data.outlets.filter((o: any) => !o.is_canceled)
						.length})
				</button>
				<button
					type="button"
					onclick={() => (filterStatus = "canceled")}
					class="px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer {filterStatus ===
					'canceled'
						? 'bg-white text-red-700 shadow-xs'
						: 'text-slate-600 hover:text-slate-900'}"
				>
					Canceladas ({data.outlets.filter((o: any) => o.is_canceled)
						.length})
				</button>
			</div>
		</div>

		<!-- Outlets Table -->
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
								>Folio / ID Venta</th
							>
							<th scope="col" class="px-4 py-3.5 font-semibold"
								>Fecha y Hora</th
							>
							<th
								scope="col"
								class="px-4 py-3.5 text-center font-semibold"
								>Artículos</th
							>
							<th
								scope="col"
								class="px-4 py-3.5 text-right font-semibold"
								>Total Venta</th
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
						{#if filteredOutlets.length === 0}
							<tr>
								<td
									colspan="6"
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
												d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
											/>
										</svg>
										<p class="font-medium text-slate-900">
											No se encontraron ventas registradas
										</p>
										<p class="text-xs text-slate-500">
											Las ventas procesadas desde el punto
											de venta aparecerán aquí.
										</p>
									</div>
								</td>
							</tr>
						{:else}
							{#each filteredOutlets as outlet (outlet.id)}
								<tr
									class="hover:bg-slate-50/60 transition-colors {outlet.is_canceled
										? 'bg-red-50/20'
										: ''}"
								>
									<!-- Folio & UUID -->
									<td class="px-4 py-3.5">
										<div
											class="font-mono text-xs text-slate-900 font-semibold flex items-center gap-1.5"
										>
											<span class="text-slate-400">#</span>
											<span>{outlet.folio != null ? outlet.folio : outlet.id.slice(0, 8)}</span>
										</div>
										<div
											class="text-[10px] text-slate-400 font-mono"
										>
											ID: {outlet.id}
										</div>
									</td>

									<!-- Timestamp -->
									<td
										class="px-4 py-3.5 text-xs text-slate-600"
									>
										{formatDate(outlet.created_at)}
									</td>

									<!-- Items count -->
									<td class="px-4 py-3.5 text-center">
										<span
											class="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 border border-slate-200"
										>
											{outlet.items.length}
											{outlet.items.length === 1
												? "producto"
												: "productos"}
										</span>
									</td>

									<!-- Total Amount -->
									<td
										class="px-4 py-3.5 text-right font-mono font-bold text-sm {outlet.is_canceled
											? 'text-slate-400 line-through'
											: 'text-slate-900'}"
									>
										${outlet.total_amount.toFixed(2)}
									</td>

									<!-- Status -->
									<td class="px-4 py-3.5 text-center">
										{#if outlet.is_canceled}
											<span
												class="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 border border-red-200"
											>
												<span
													class="h-1.5 w-1.5 rounded-full bg-red-600"
												></span>
												Cancelada / Devuelta
											</span>
											{#if outlet.cancel_reason}
												<div
													class="text-[10px] text-red-600/80 mt-1 max-w-xs truncate"
													title={outlet.cancel_reason}
												>
													Motivo: {outlet.cancel_reason}
												</div>
											{/if}
										{:else}
											<span
												class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200"
											>
												<span
													class="h-1.5 w-1.5 rounded-full bg-emerald-600"
												></span>
												Venta Activa
											</span>
										{/if}
									</td>

									<!-- Actions -->
									<td
										class="px-4 py-3.5 text-right space-x-2"
									>
										<button
											type="button"
											onclick={() =>
												openDetailModal(outlet)}
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
													d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
												/>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
												/>
											</svg>
											Ver Artículos
										</button>

										{#if !outlet.is_canceled}
											<button
												type="button"
												onclick={() =>
													openCancelModal(outlet)}
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
														d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
													/>
												</svg>
												Devolución
											</button>
										{/if}
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Detail Modal -->
		{#if selectedOutletForDetail}
			<div
				class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
				role="dialog"
				aria-modal="true"
			>
				<div
					class="fixed inset-0"
					onclick={closeDetailModal}
					aria-hidden="true"
				></div>
				<div
					class="relative w-full max-w-2xl rounded-xl bg-white border border-slate-200 p-6 shadow-xl text-slate-900 z-10 max-h-[90vh] overflow-y-auto space-y-4"
				>
					<div
						class="flex items-center justify-between border-b border-slate-100 pb-3"
					>
						<div>
							<h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
								<span>Detalle de Salida de Inventario</span>
								{#if selectedOutletForDetail.folio != null}
									<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-slate-100 text-slate-800 border border-slate-200">
										Folio #{selectedOutletForDetail.folio}
									</span>
								{/if}
							</h3>
							<p class="text-xs text-slate-500 font-mono">
								ID: {selectedOutletForDetail.id}
							</p>
						</div>
						<button
							type="button"
							onclick={closeDetailModal}
							class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
						>
							<svg
								class="h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</div>

					<div class="space-y-3">
						<div
							class="text-xs font-semibold uppercase tracking-wider text-slate-500"
						>
							Renglones de la Venta:
						</div>
						<div
							class="overflow-x-auto rounded-lg border border-slate-200"
						>
							<table
								class="w-full text-left text-xs text-slate-700"
							>
								<thead
									class="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200"
								>
									<tr>
										<th class="px-3 py-2">SKU</th>
										<th class="px-3 py-2">Producto</th>
										<th class="px-3 py-2 text-center"
											>Cantidad</th
										>
										<th class="px-3 py-2 text-right"
											>P. Unitario</th
										>
										<th class="px-3 py-2 text-right"
											>Subtotal</th
										>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#if selectedOutletForDetail.items.length === 0}
										<tr>
											<td
												colspan="5"
												class="px-4 py-8 text-center text-slate-500"
											>
												<div
													class="flex flex-col items-center justify-center gap-1.5"
												>
													<svg
														class="h-6 w-6 text-slate-300"
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
													<p
														class="font-medium text-slate-900"
													>
														No se encontraron
														artículos para esta
														venta
													</p>
													<p
														class="text-[11px] text-slate-500 max-w-sm"
													>
														Si los productos fueron
														cobrados, asegúrese de
														que la política RLS en <span
															class="font-mono text-slate-700"
															>stock_outlet_items</span
														> esté aplicada en la base
														de datos.
													</p>
												</div>
											</td>
										</tr>
									{:else}
										{#each selectedOutletForDetail.items as item}
											<tr>
												<td
													class="px-3 py-2.5 font-mono text-slate-600"
													>{item.sku_code}</td
												>
												<td
													class="px-3 py-2.5 font-semibold text-slate-900"
													>{item.product_name}</td
												>
												<td
													class="px-3 py-2.5 text-center font-mono text-slate-700"
													>{item.quantity.toFixed(
														3,
													)}</td
												>
												<td
													class="px-3 py-2.5 text-right font-mono text-slate-700"
													>${item.unit_price.toFixed(
														2,
													)}</td
												>
												<td
													class="px-3 py-2.5 text-right font-mono font-bold text-slate-900"
													>${item.subtotal.toFixed(
														2,
													)}</td
												>
											</tr>
										{/each}
									{/if}
								</tbody>
							</table>
						</div>
					</div>

					<div
						class="flex justify-between items-center pt-3 border-t border-slate-100 text-sm"
					>
						<span class="text-slate-500 font-medium"
							>Total de la Operación:</span
						>
						<span class="text-xl font-bold font-mono text-slate-900"
							>${selectedOutletForDetail.total_amount.toFixed(
								2,
							)}</span
						>
					</div>

					<div class="flex justify-end pt-2">
						<button
							type="button"
							onclick={closeDetailModal}
							class="rounded-lg bg-white border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm cursor-pointer"
						>
							Cerrar
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Cancel / Return Modal -->
		{#if selectedOutletForCancel}
			<div
				class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
				role="dialog"
				aria-modal="true"
			>
				<div
					class="fixed inset-0"
					onclick={closeCancelModal}
					aria-hidden="true"
				></div>
				<div
					class="relative w-full max-w-md rounded-xl bg-white border border-slate-200 p-6 shadow-xl text-slate-900 z-10 space-y-4"
				>
					<div class="flex items-center gap-3">
						<div
							class="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 border border-red-200 text-red-600"
						>
							<svg
								class="h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								/>
							</svg>
						</div>
						<div>
							<h3 class="text-base font-bold text-slate-900">
								Solicitar Devolución / Cancelación
							</h3>
							<p class="text-xs text-slate-500 font-mono">
								{#if selectedOutletForCancel.folio != null}
									Folio #{selectedOutletForCancel.folio} • ID: {selectedOutletForCancel.id.slice(0, 8)}...
								{:else}
									Venta: {selectedOutletForCancel.id.slice(0, 8)}...
								{/if}
							</p>
						</div>
					</div>

					<p class="text-xs text-slate-600 leading-relaxed">
						Esta acción cancelará la venta por <span
							class="font-bold text-slate-900"
							>${selectedOutletForCancel.total_amount.toFixed(
								2,
							)}</span
						>, restaurará el stock de todos los artículos en
						inventario y generará una entrada inmutable de
						<span class="font-semibold text-amber-700"
							>DEVOLUCION</span
						> en auditoría.
					</p>

					<form
						method="POST"
						action="?/cancel"
						use:enhance={() => {
							canceling = true;
							return async ({ update }) => {
								canceling = false;
								closeCancelModal();
								await update();
							};
						}}
						class="space-y-4"
					>
						<input
							type="hidden"
							name="outlet_id"
							value={selectedOutletForCancel.id}
						/>

						<div>
							<label
								for="cancel-reason-input"
								class="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
							>
								Motivo de la Devolución <span
									class="text-red-600">*</span
								>
							</label>
							<textarea
								id="cancel-reason-input"
								name="reason"
								rows="3"
								required
								bind:value={cancelReason}
								placeholder="Ej. Producto defectuoso, error en cobro, cliente canceló compra..."
								class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600 resize-none shadow-sm"
							></textarea>
						</div>

						<div
							class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100"
						>
							<button
								type="button"
								onclick={closeCancelModal}
								disabled={canceling}
								class="rounded-lg px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
							>
								Volver
							</button>
							<button
								id="btn-confirm-cancel"
								type="submit"
								disabled={canceling ||
									cancelReason.trim().length < 3}
								class="rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition-all cursor-pointer"
							>
								{#if canceling}
									Procesando devolución...
								{:else}
									Confirmar Devolución
								{/if}
							</button>
						</div>
					</form>
				</div>
			</div>
		{/if}
	</div>
</div>

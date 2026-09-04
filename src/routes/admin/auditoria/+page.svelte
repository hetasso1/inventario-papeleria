<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	interface AuditLog {
		id: string;
		product_id: string;
		product_name?: string;
		sku_code?: string;
		change_type:
			| "VENTA"
			| "DEVOLUCION"
			| "REABASTECIMIENTO"
			| "AJUSTE_MANUAL"
			| "MERMA";
		previous_stock: number;
		new_stock: number;
		quantity_changed: number;
		reference_id?: string | null;
		created_by?: string | null;
		notes?: string | null;
		created_at: string;
	}

	let logs = $derived<AuditLog[]>(data.logs ?? []);
	let error = $derived<string | null>(data.error ?? null);

	let selectedType = $state<string>("ALL");
	let searchQuery = $state("");
	let refreshing = $state(false);

	async function refreshLogs() {
		refreshing = true;
		try {
			await invalidateAll();
		} finally {
			refreshing = false;
		}
	}

	let filteredLogs = $derived(
		logs.filter((log) => {
			if (selectedType !== "ALL" && log.change_type !== selectedType) {
				return false;
			}
			if (!searchQuery.trim()) return true;
			const term = searchQuery.toLowerCase();
			const matchProd = log.product_name?.toLowerCase().includes(term);
			const matchSku = log.sku_code?.toLowerCase().includes(term);
			const matchRef = log.reference_id?.toLowerCase().includes(term);
			const matchNotes = log.notes?.toLowerCase().includes(term);
			return matchProd || matchSku || matchRef || matchNotes;
		}),
	);

	function formatDate(dateStr: string) {
		if (!dateStr) return "N/A";
		const d = new Date(dateStr);
		return d.toLocaleString("es-MX", {
			year: "numeric",
			month: "short",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	}

	function getTypeBadgeClass(type: string) {
		switch (type) {
			case "VENTA":
				return "bg-blue-50 text-blue-700 border-blue-200";
			case "DEVOLUCION":
				return "bg-rose-50 text-rose-700 border-rose-200";
			case "REABASTECIMIENTO":
				return "bg-emerald-50 text-emerald-700 border-emerald-200";
			case "AJUSTE_MANUAL":
				return "bg-amber-50 text-amber-700 border-amber-200";
			case "MERMA":
				return "bg-orange-50 text-orange-700 border-orange-200";
			default:
				return "bg-slate-100 text-slate-700 border-slate-200";
		}
	}
</script>

<svelte:head>
	<title>Auditoría de Inventario — Solo Lectura</title>
	<meta
		name="description"
		content="Registro inmutable de movimientos y auditoría de stock."
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
						Auditoría Inmutable
					</span>
					<span class="text-xs text-slate-400">•</span>
					<span
						class="text-xs text-amber-800 font-semibold flex items-center gap-1"
					>
						<svg
							class="h-3.5 w-3.5 text-amber-700"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
								clip-rule="evenodd"
							/>
						</svg>
						Solo Lectura (Admin)
					</span>
				</div>
				<h1
					class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1"
				>
					Bitácora de Auditoría de Stock
				</h1>
				<p class="text-sm text-slate-500 mt-1">
					Registro forense e inalterable de todos los movimientos de
					inventario disparados por triggers y RPCs.
				</p>
			</div>

			<div class="flex items-center gap-3">
				<button
					type="button"
					onclick={refreshLogs}
					disabled={refreshing}
					class="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
				>
					<svg
						class="h-4 w-4 text-slate-500 {refreshing
							? 'animate-spin'
							: ''}"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
					Actualizar Bitácora
				</button>
			</div>
		</div>

		<!-- Error alert -->
		{#if error}
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
					<span>{error}</span>
				</div>
			</div>
		{/if}

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
					id="audit-search-input"
					type="text"
					bind:value={searchQuery}
					placeholder="Filtrar por producto, SKU, notas o referencia..."
					class="block w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
				/>
			</div>

			<!-- Type filter buttons (Tabs Shadcn) -->
			<div
				class="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs"
			>
				<button
					type="button"
					onclick={() => (selectedType = "ALL")}
					class="px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer {selectedType ===
					'ALL'
						? 'bg-white text-slate-900 shadow-xs'
						: 'text-slate-600 hover:text-slate-900'}"
				>
					Todos
				</button>
				<button
					type="button"
					onclick={() => (selectedType = "VENTA")}
					class="px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer {selectedType ===
					'VENTA'
						? 'bg-white text-blue-700 shadow-xs'
						: 'text-slate-600 hover:text-slate-900'}"
				>
					Ventas
				</button>
				<button
					type="button"
					onclick={() => (selectedType = "DEVOLUCION")}
					class="px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer {selectedType ===
					'DEVOLUCION'
						? 'bg-white text-rose-700 shadow-xs'
						: 'text-slate-600 hover:text-slate-900'}"
				>
					Devoluciones
				</button>
				<button
					type="button"
					onclick={() => (selectedType = "REABASTECIMIENTO")}
					class="px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer {selectedType ===
					'REABASTECIMIENTO'
						? 'bg-white text-emerald-700 shadow-xs'
						: 'text-slate-600 hover:text-slate-900'}"
				>
					Reabastecimiento
				</button>
				<button
					type="button"
					onclick={() => (selectedType = "AJUSTE_MANUAL")}
					class="px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer {selectedType ===
					'AJUSTE_MANUAL'
						? 'bg-white text-amber-700 shadow-xs'
						: 'text-slate-600 hover:text-slate-900'}"
				>
					Ajustes
				</button>
				<button
					type="button"
					onclick={() => (selectedType = "MERMA")}
					class="px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer {selectedType ===
					'MERMA'
						? 'bg-white text-orange-700 shadow-xs'
						: 'text-slate-600 hover:text-slate-900'}"
				>
					Mermas
				</button>
			</div>
		</div>

		<!-- Table -->
		<div
			class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
		>
			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs text-slate-700">
					<thead
						class="bg-slate-50/80 uppercase tracking-wider text-slate-500 border-b border-slate-200 text-[11px] font-semibold"
					>
						<tr>
							<th scope="col" class="px-4 py-3">Fecha / Hora</th>
							<th scope="col" class="px-4 py-3">Tipo de Cambio</th
							>
							<th scope="col" class="px-4 py-3">Producto / SKU</th
							>
							<th scope="col" class="px-3 py-3 text-right"
								>Stock Anterior</th
							>
							<th scope="col" class="px-3 py-3 text-center"
								>Variación</th
							>
							<th scope="col" class="px-3 py-3 text-right"
								>Stock Nuevo</th
							>
							<th scope="col" class="px-4 py-3"
								>Referencia / Usuario</th
							>
							<th scope="col" class="px-4 py-3">Notas</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100 font-mono">
						{#if filteredLogs.length === 0}
							<tr>
								<td
									colspan="8"
									class="px-6 py-12 text-center text-slate-500 font-sans"
								>
									<p class="font-medium text-slate-900">
										No se encontraron registros de auditoría
									</p>
									<p class="text-xs text-slate-500 mt-1">
										Los movimientos de stock quedarán
										asentados aquí automáticamente.
									</p>
								</td>
							</tr>
						{:else}
							{#each filteredLogs as log (log.id)}
								{@const isNegative = log.quantity_changed < 0}
								<tr
									class="hover:bg-slate-50/60 transition-colors"
								>
									<!-- Timestamp -->
									<td
										class="px-4 py-3 text-slate-600 whitespace-nowrap"
									>
										{formatDate(log.created_at)}
									</td>

									<!-- Type badge -->
									<td class="px-4 py-3 font-sans">
										<span
											class="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border {getTypeBadgeClass(
												log.change_type,
											)}"
										>
											{log.change_type}
										</span>
									</td>

									<!-- Product & SKU -->
									<td class="px-4 py-3 font-sans">
										<div
											class="font-semibold text-slate-900"
										>
											{log.product_name}
										</div>
										<div
											class="text-[10px] font-mono text-slate-500"
										>
											{log.sku_code}
										</div>
									</td>

									<!-- Previous Stock -->
									<td
										class="px-3 py-3 text-right text-slate-500"
									>
										{log.previous_stock.toFixed(3)}
									</td>

									<!-- Variation -->
									<td class="px-3 py-3 text-center">
										<span
											class="inline-flex items-center px-1.5 py-0.5 rounded font-bold border {isNegative
												? 'text-red-700 bg-red-50 border-red-200'
												: 'text-emerald-700 bg-emerald-50 border-emerald-200'}"
										>
											{isNegative
												? ""
												: "+"}{log.quantity_changed.toFixed(
												3,
											)}
										</span>
									</td>

									<!-- New Stock -->
									<td
										class="px-3 py-3 text-right font-bold text-slate-900"
									>
										{log.new_stock.toFixed(3)}
									</td>

									<!-- Reference & User -->
									<td class="px-4 py-3 font-sans text-[11px]">
										{#if log.reference_id}
											<div
												class="text-slate-700 truncate max-w-[140px] font-mono"
												title={log.reference_id}
											>
												Ref: {log.reference_id.slice(
													0,
													8,
												)}...
											</div>
										{/if}
										{#if log.created_by}
											<div
												class="text-slate-400 truncate max-w-[140px] font-mono text-[10px]"
												title={log.created_by}
											>
												User: {log.created_by.slice(
													0,
													8,
												)}...
											</div>
										{/if}
									</td>

									<!-- Notes -->
									<td
										class="px-4 py-3 font-sans text-slate-500 text-xs"
									>
										{log.notes ?? "—"}
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>

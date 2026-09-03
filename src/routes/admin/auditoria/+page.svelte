<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	interface AuditLog {
		id: string;
		product_id: string;
		product_name?: string;
		sku_code?: string;
		change_type: 'VENTA' | 'DEVOLUCION' | 'REABASTECIMIENTO' | 'AJUSTE_MANUAL' | 'MERMA';
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

	let selectedType = $state<string>('ALL');
	let searchQuery = $state('');
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
			if (selectedType !== 'ALL' && log.change_type !== selectedType) {
				return false;
			}
			if (!searchQuery.trim()) return true;
			const term = searchQuery.toLowerCase();
			const matchProd = log.product_name?.toLowerCase().includes(term);
			const matchSku = log.sku_code?.toLowerCase().includes(term);
			const matchRef = log.reference_id?.toLowerCase().includes(term);
			const matchNotes = log.notes?.toLowerCase().includes(term);
			return matchProd || matchSku || matchRef || matchNotes;
		})
	);

	function formatDate(dateStr: string) {
		if (!dateStr) return 'N/A';
		const d = new Date(dateStr);
		return d.toLocaleString('es-MX', {
			year: 'numeric',
			month: 'short',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function getTypeBadgeClass(type: string) {
		switch (type) {
			case 'VENTA':
				return 'bg-blue-500/10 text-blue-400 ring-blue-500/20';
			case 'DEVOLUCION':
				return 'bg-rose-500/10 text-rose-400 ring-rose-500/20';
			case 'REABASTECIMIENTO':
				return 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20';
			case 'AJUSTE_MANUAL':
				return 'bg-amber-500/10 text-amber-400 ring-amber-500/20';
			case 'MERMA':
				return 'bg-orange-500/10 text-orange-400 ring-orange-500/20';
			default:
				return 'bg-slate-500/10 text-slate-400 ring-slate-500/20';
		}
	}
</script>

<svelte:head>
	<title>Auditoría de Inventario — Solo Lectura</title>
	<meta name="description" content="Registro inmutable de movimientos y auditoría de stock." />
</svelte:head>

<div class="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
	<div class="max-w-7xl mx-auto space-y-6">
		<!-- Header -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
			<div>
				<div class="flex items-center gap-2">
					<span class="inline-flex items-center rounded-md bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
						Auditoría Inmutable
					</span>
					<span class="text-xs text-slate-500">•</span>
					<span class="text-xs text-amber-400 font-semibold flex items-center gap-1">
						<svg class="h-3.5 w-3.5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
						</svg>
						Solo Lectura (Admin)
					</span>
				</div>
				<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">Bitácora de Auditoría de Stock</h1>
				<p class="text-sm text-slate-400 mt-1">Registro forense e inalterable de todos los movimientos de inventario disparados por triggers y RPCs.</p>
			</div>

			<div class="flex items-center gap-3">
				<button
					type="button"
					onclick={refreshLogs}
					disabled={refreshing}
					class="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
				>
					<svg class="h-4 w-4 {refreshing ? 'animate-spin' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
					Actualizar Bitácora
				</button>
			</div>
		</div>

		<!-- Error alert -->
		{#if error}
			<div role="alert" class="rounded-xl bg-red-950/80 border border-red-500/50 p-4 text-sm text-red-200 flex items-center justify-between shadow-lg">
				<div class="flex items-center gap-2.5">
					<svg class="h-5 w-5 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
					</svg>
					<span>{error}</span>
				</div>
			</div>
		{/if}

		<!-- Filters & Search -->
		<div class="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-sm">
			<div class="relative w-full sm:w-96">
				<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
				</div>
				<input
					id="audit-search-input"
					type="text"
					bind:value={searchQuery}
					placeholder="Filtrar por producto, SKU, notas o referencia..."
					class="block w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				/>
			</div>

			<!-- Type filter buttons -->
			<div class="flex flex-wrap items-center gap-1.5 text-xs">
				<button
					type="button"
					onclick={() => (selectedType = 'ALL')}
					class="px-2.5 py-1.5 rounded-lg font-semibold transition-colors {selectedType === 'ALL'
						? 'bg-indigo-600 text-white'
						: 'bg-slate-800 text-slate-400 hover:text-slate-200'}"
				>
					Todos
				</button>
				<button
					type="button"
					onclick={() => (selectedType = 'VENTA')}
					class="px-2.5 py-1.5 rounded-lg font-semibold transition-colors {selectedType === 'VENTA'
						? 'bg-blue-600 text-white'
						: 'bg-slate-800 text-blue-400 hover:bg-slate-700'}"
				>
					Ventas
				</button>
				<button
					type="button"
					onclick={() => (selectedType = 'DEVOLUCION')}
					class="px-2.5 py-1.5 rounded-lg font-semibold transition-colors {selectedType === 'DEVOLUCION'
						? 'bg-rose-600 text-white'
						: 'bg-slate-800 text-rose-400 hover:bg-slate-700'}"
				>
					Devoluciones
				</button>
				<button
					type="button"
					onclick={() => (selectedType = 'REABASTECIMIENTO')}
					class="px-2.5 py-1.5 rounded-lg font-semibold transition-colors {selectedType === 'REABASTECIMIENTO'
						? 'bg-emerald-600 text-white'
						: 'bg-slate-800 text-emerald-400 hover:bg-slate-700'}"
				>
					Reabastecimiento
				</button>
				<button
					type="button"
					onclick={() => (selectedType = 'AJUSTE_MANUAL')}
					class="px-2.5 py-1.5 rounded-lg font-semibold transition-colors {selectedType === 'AJUSTE_MANUAL'
						? 'bg-amber-600 text-white'
						: 'bg-slate-800 text-amber-400 hover:bg-slate-700'}"
				>
					Ajustes
				</button>
				<button
					type="button"
					onclick={() => (selectedType = 'MERMA')}
					class="px-2.5 py-1.5 rounded-lg font-semibold transition-colors {selectedType === 'MERMA'
						? 'bg-orange-600 text-white'
						: 'bg-slate-800 text-orange-400 hover:bg-slate-700'}"
				>
					Mermas
				</button>
			</div>
		</div>

		<!-- Table -->
		<div class="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 shadow-xl backdrop-blur-sm">
			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs text-slate-300">
					<thead class="bg-slate-900/90 uppercase tracking-wider text-slate-400 border-b border-slate-800 text-[11px]">
						<tr>
							<th scope="col" class="px-4 py-3">Fecha / Hora</th>
							<th scope="col" class="px-4 py-3">Tipo de Cambio</th>
							<th scope="col" class="px-4 py-3">Producto / SKU</th>
							<th scope="col" class="px-3 py-3 text-right">Stock Anterior</th>
							<th scope="col" class="px-3 py-3 text-center">Variación</th>
							<th scope="col" class="px-3 py-3 text-right">Stock Nuevo</th>
							<th scope="col" class="px-4 py-3">Referencia / Usuario</th>
							<th scope="col" class="px-4 py-3">Notas</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-800/60 font-mono">
						{#if filteredLogs.length === 0}
							<tr>
								<td colspan="8" class="px-6 py-12 text-center text-slate-500 font-sans">
									<p class="font-medium text-slate-400">No se encontraron registros de auditoría</p>
									<p class="text-xs text-slate-500 mt-1">Los movimientos de stock quedarán asentados aquí automáticamente.</p>
								</td>
							</tr>
						{:else}
							{#each filteredLogs as log (log.id)}
								{@const isNegative = log.quantity_changed < 0}
								<tr class="hover:bg-slate-800/30 transition-colors">
									<!-- Timestamp -->
									<td class="px-4 py-3 text-slate-300 whitespace-nowrap">
										{formatDate(log.created_at)}
									</td>

									<!-- Type badge -->
									<td class="px-4 py-3 font-sans">
										<span class="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {getTypeBadgeClass(log.change_type)}">
											{log.change_type}
										</span>
									</td>

									<!-- Product & SKU -->
									<td class="px-4 py-3 font-sans">
										<div class="font-semibold text-slate-200">{log.product_name}</div>
										<div class="text-[10px] font-mono text-indigo-400">{log.sku_code}</div>
									</td>

									<!-- Previous Stock -->
									<td class="px-3 py-3 text-right text-slate-400">
										{log.previous_stock.toFixed(3)}
									</td>

									<!-- Variation -->
									<td class="px-3 py-3 text-center">
										<span class="inline-flex items-center px-1.5 py-0.5 rounded font-bold {isNegative ? 'text-red-400 bg-red-950/30' : 'text-emerald-400 bg-emerald-950/30'}">
											{isNegative ? '' : '+'}{log.quantity_changed.toFixed(3)}
										</span>
									</td>

									<!-- New Stock -->
									<td class="px-3 py-3 text-right font-bold text-slate-100">
										{log.new_stock.toFixed(3)}
									</td>

									<!-- Reference & User -->
									<td class="px-4 py-3 font-sans text-[11px]">
										{#if log.reference_id}
											<div class="text-slate-300 truncate max-w-[140px] font-mono" title={log.reference_id}>
												Ref: {log.reference_id.slice(0, 8)}...
											</div>
										{/if}
										{#if log.created_by}
											<div class="text-slate-500 truncate max-w-[140px] font-mono text-[10px]" title={log.created_by}>
												User: {log.created_by.slice(0, 8)}...
											</div>
										{/if}
									</td>

									<!-- Notes -->
									<td class="px-4 py-3 font-sans text-slate-400 text-xs">
										{log.notes ?? '—'}
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

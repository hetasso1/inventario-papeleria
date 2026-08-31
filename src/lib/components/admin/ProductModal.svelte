<script lang="ts">
	import { enhance } from '$app/forms';

	export interface ProductData {
		id?: string;
		sku_code: string;
		name: string;
		description?: string | null;
		price: number;
		cost?: number | null;
		stock: number;
		min_stock: number;
		image_url?: string | null;
		is_active?: boolean;
	}

	let {
		isOpen = false,
		product = null,
		onClose
	}: {
		isOpen: boolean;
		product: ProductData | null;
		onClose: () => void;
	} = $props();

	let isEditing = $derived(!!product?.id);
	let modalTitle = $derived(isEditing ? 'Editar Producto' : 'Nuevo Producto');

	let submitting = $state(false);
	let formError = $state<string | null>(null);

	// Local state bound to inputs
	let sku = $state('');
	let name = $state('');
	let description = $state('');
	let price = $state<number | string>(0);
	let cost = $state<number | string>(0);
	let stock = $state<number | string>(0);
	let minStock = $state<number | string>(5);
	let imageUrl = $state('');

	$effect(() => {
		if (product) {
			sku = product.sku_code ?? '';
			name = product.name ?? '';
			description = product.description ?? '';
			price = product.price ?? 0;
			cost = product.cost ?? 0;
			stock = product.stock ?? 0;
			minStock = product.min_stock ?? 5;
			imageUrl = product.image_url ?? '';
		} else {
			sku = '';
			name = '';
			description = '';
			price = 0;
			cost = 0;
			stock = 0;
			minStock = 5;
			imageUrl = '';
		}
		formError = null;
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && isOpen) {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity animate-fade-in"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<!-- Backdrop click to close -->
		<div class="fixed inset-0" onclick={onClose} aria-hidden="true"></div>

		<div
			class="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl shadow-black/60 z-10 max-h-[90vh] overflow-y-auto"
		>
			<div class="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
						</svg>
					</div>
					<h2 id="modal-title" class="text-xl font-bold text-slate-100">{modalTitle}</h2>
				</div>
				<button
					type="button"
					onclick={onClose}
					class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
					aria-label="Cerrar modal"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			{#if formError}
				<div role="alert" class="mb-5 rounded-lg bg-red-950/60 border border-red-500/40 p-3 text-sm text-red-300 flex items-center gap-2">
					<svg class="h-5 w-5 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
					</svg>
					<span>{formError}</span>
				</div>
			{/if}

			<form
				method="POST"
				action="?/upsert"
				use:enhance={() => {
					submitting = true;
					formError = null;
					return async ({ result, update }) => {
						submitting = false;
						if (result.type === 'failure') {
							formError = (result.data?.error as string) ?? 'Ocurrió un error al guardar el producto.';
						} else if (result.type === 'success') {
							await update();
							onClose();
						}
					};
				}}
				class="space-y-5"
			>
				{#if isEditing && product?.id}
					<input type="hidden" name="id" value={product.id} />
				{/if}

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<!-- SKU Code -->
					<div>
						<label for="sku_code" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Código SKU <span class="text-indigo-400">*</span>
						</label>
						<input
							id="sku_code"
							name="sku_code"
							type="text"
							required
							bind:value={sku}
							placeholder="SKU-1002"
							class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
						/>
					</div>

					<!-- Name -->
					<div>
						<label for="name" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Nombre del Producto <span class="text-indigo-400">*</span>
						</label>
						<input
							id="name"
							name="name"
							type="text"
							required
							bind:value={name}
							placeholder="Cuaderno Profesional 100h"
							class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
						/>
					</div>
				</div>

				<!-- Description -->
				<div>
					<label for="description" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Descripción
					</label>
					<textarea
						id="description"
						name="description"
						rows="2"
						bind:value={description}
						placeholder="Detalles del producto, especificaciones, color..."
						class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					></textarea>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<!-- Price -->
					<div>
						<label for="price" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Precio de Venta ($) <span class="text-indigo-400">*</span>
						</label>
						<input
							id="price"
							name="price"
							type="number"
							step="0.01"
							min="0"
							required
							bind:value={price}
							class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
						/>
					</div>

					<!-- Cost (Admin Only) -->
					<div>
						<label for="cost" class="block text-xs font-semibold uppercase tracking-wider text-amber-400/90 mb-1 flex items-center gap-1">
							<svg class="h-3.5 w-3.5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
							</svg>
							Costo Unitario ($) <span class="text-amber-400">* (Admin)</span>
						</label>
						<input
							id="cost"
							name="cost"
							type="number"
							step="0.01"
							min="0"
							required
							bind:value={cost}
							class="w-full rounded-lg border border-amber-500/40 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
						/>
					</div>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<!-- Stock -->
					<div>
						<label for="stock" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Stock Actual <span class="text-indigo-400">*</span>
						</label>
						<input
							id="stock"
							name="stock"
							type="number"
							step="0.001"
							min="0"
							required
							bind:value={stock}
							class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
						/>
					</div>

					<!-- Min Stock -->
					<div>
						<label for="min_stock" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Stock Mínimo (Alerta) <span class="text-indigo-400">*</span>
						</label>
						<input
							id="min_stock"
							name="min_stock"
							type="number"
							step="0.001"
							min="0"
							required
							bind:value={minStock}
							class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
						/>
					</div>
				</div>

				<!-- Image URL -->
				<div>
					<label for="image_url" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						URL de Imagen
					</label>
					<input
						id="image_url"
						name="image_url"
						type="url"
						bind:value={imageUrl}
						placeholder="https://ejemplo.com/producto.jpg"
						class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					/>
				</div>

				<!-- Actions -->
				<div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 mt-6">
					<button
						type="button"
						onclick={onClose}
						disabled={submitting}
						class="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
					>
						Cancelar
					</button>
					<button
						id="btn-submit-product"
						type="submit"
						disabled={submitting}
						class="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 transition-all"
					>
						{#if submitting}
							<svg class="animate-spin -ml-1 mr-1 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
							</svg>
							Guardando...
						{:else}
							{isEditing ? 'Guardar Cambios' : 'Crear Producto'}
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

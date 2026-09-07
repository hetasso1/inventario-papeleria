<script lang="ts" module>
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

	export interface ProductFormValues {
		sku?: string;
		name?: string;
		description?: string;
		price?: number | string;
		cost?: number | string;
		stock?: number | string;
		minStock?: number | string;
		imageUrl?: string;
	}

	/**
	 * Pure function to detect dirty state in product creation or edition.
	 */
	export function isProductFormDirty(
		initial: ProductData | null,
		current: ProductFormValues
	): boolean {
		if (!initial) {
			const sku = (current.sku ?? '').trim();
			const name = (current.name ?? '').trim();
			const desc = (current.description ?? '').trim();
			const price = Number(current.price ?? 0);
			const cost = Number(current.cost ?? 0);
			const stock = Number(current.stock ?? 0);
			const minStock = current.minStock !== undefined && current.minStock !== '' ? Number(current.minStock) : 5;
			const img = (current.imageUrl ?? '').trim();

			return (
				sku !== '' ||
				name !== '' ||
				desc !== '' ||
				price !== 0 ||
				cost !== 0 ||
				stock !== 0 ||
				minStock !== 5 ||
				img !== ''
			);
		}

		const curSku = (current.sku ?? '').trim();
		const initSku = (initial.sku_code ?? '').trim();
		if (curSku !== initSku) return true;

		const curName = (current.name ?? '').trim();
		const initName = (initial.name ?? '').trim();
		if (curName !== initName) return true;

		const curDesc = (current.description ?? '').trim();
		const initDesc = (initial.description ?? '').trim();
		if (curDesc !== initDesc) return true;

		const curPrice = Number(current.price ?? 0);
		const initPrice = Number(initial.price ?? 0);
		if (curPrice !== initPrice) return true;

		const curCost = Number(current.cost ?? 0);
		const initCost = Number(initial.cost ?? 0);
		if (curCost !== initCost) return true;

		const curStock = Number(current.stock ?? 0);
		const initStock = Number(initial.stock ?? 0);
		if (curStock !== initStock) return true;

		const curMinStock = current.minStock !== undefined && current.minStock !== '' ? Number(current.minStock) : 5;
		const initMinStock = Number(initial.min_stock ?? 5);
		if (curMinStock !== initMinStock) return true;

		const curImg = (current.imageUrl ?? '').trim();
		const initImg = (initial.image_url ?? '').trim();
		if (curImg !== initImg) return true;

		return false;
	}
</script>

<script lang="ts">
	import { enhance } from "$app/forms";

	let {
		isOpen = false,
		product = null,
		onClose,
	}: {
		isOpen: boolean;
		product: ProductData | null;
		onClose: () => void;
	} = $props();

	let isEditing = $derived(!!product?.id);
	let modalTitle = $derived(isEditing ? "Editar Producto" : "Nuevo Producto");

	let submitting = $state(false);
	let formError = $state<string | null>(null);
	let showUnsavedConfirm = $state(false);

	// Local state bound to inputs
	let sku = $state("");
	let name = $state("");
	let description = $state("");
	let price = $state<number | string>(0);
	let cost = $state<number | string>(0);
	let stock = $state<number | string>(0);
	let minStock = $state<number | string>(5);
	let imageUrl = $state("");

	let isDirty = $derived(
		isProductFormDirty(product, {
			sku,
			name,
			description,
			price,
			cost,
			stock,
			minStock,
			imageUrl
		})
	);

	$effect(() => {
		if (product) {
			sku = product.sku_code ?? "";
			name = product.name ?? "";
			description = product.description ?? "";
			price = product.price ?? 0;
			cost = product.cost ?? 0;
			stock = product.stock ?? 0;
			minStock = product.min_stock ?? 5;
			imageUrl = product.image_url ?? "";
		} else {
			sku = "";
			name = "";
			description = "";
			price = 0;
			cost = 0;
			stock = 0;
			minStock = 5;
			imageUrl = "";
		}
		formError = null;
		showUnsavedConfirm = false;
	});

	function handleBackdropClick() {
		if (showUnsavedConfirm) {
			showUnsavedConfirm = false;
			return;
		}
		if (isDirty) {
			showUnsavedConfirm = true;
		} else {
			onClose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape" && isOpen) {
			if (showUnsavedConfirm) {
				showUnsavedConfirm = false;
			} else if (isDirty) {
				showUnsavedConfirm = true;
			} else {
				onClose();
			}
		}
	}

	function discardAndClose() {
		showUnsavedConfirm = false;
		formError = null;
		onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<!-- Backdrop click to close (guarded if dirty) -->
		<div class="fixed inset-0" onclick={handleBackdropClick} aria-hidden="true"></div>

		<div
			class="relative w-full max-w-2xl overflow-hidden rounded-xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xl text-slate-900 z-10 max-h-[90vh] overflow-y-auto space-y-6"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between border-b border-slate-100 pb-4"
			>
				<div class="flex items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-900"
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
								stroke-width="1.5"
								d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
							/>
						</svg>
					</div>
					<div>
						<h2
							id="modal-title"
							class="text-xl font-bold tracking-tight text-slate-900"
						>
							{modalTitle}
						</h2>
						<p class="text-xs text-slate-500">
							Ingresa los detalles del artículo para el catálogo.
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={onClose}
					class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
					aria-label="Cerrar modal"
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

			{#if formError}
				<div
					role="alert"
					class="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2"
				>
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
						if (result.type === "failure") {
							formError =
								(result.data?.error as string) ??
								"Ocurrió un error al guardar el producto.";
						} else if (result.type === "success") {
							await update();
							onClose();
						}
					};
				}}
				class="space-y-4"
			>
				{#if isEditing && product?.id}
					<input type="hidden" name="id" value={product.id} />
				{/if}

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<!-- SKU Code -->
					<div>
						<label
							for="sku_code"
							class="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
						>
							Código SKU <span class="text-black">*</span>
						</label>
						<input
							id="sku_code"
							name="sku_code"
							type="text"
							required
							bind:value={sku}
							placeholder="SKU-1002"
							class="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						/>
					</div>

					<!-- Name -->
					<div>
						<label
							for="name"
							class="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
						>
							Nombre del Producto <span class="text-black">*</span
							>
						</label>
						<input
							id="name"
							name="name"
							type="text"
							required
							bind:value={name}
							placeholder="Cuaderno Profesional 100h"
							class="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						/>
					</div>
				</div>

				<!-- Description -->
				<div>
					<label
						for="description"
						class="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
					>
						Descripción
					</label>
					<textarea
						id="description"
						name="description"
						rows="2"
						bind:value={description}
						placeholder="Detalles del producto, especificaciones, color..."
						class="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black resize-none"
					></textarea>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<!-- Price -->
					<div>
						<label
							for="price"
							class="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
						>
							Precio de Venta ($) <span class="text-black">*</span
							>
						</label>
						<input
							id="price"
							name="price"
							type="number"
							step="0.01"
							min="0"
							required
							bind:value={price}
							class="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 font-mono shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						/>
					</div>

					<!-- Cost (Admin Only) -->
					<div>
						<label
							for="cost"
							class="block text-xs font-semibold uppercase tracking-wider text-amber-700 mb-1 flex items-center gap-1"
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
							Costo Unitario ($)
							<span class="text-amber-700">* (Admin)</span>
						</label>
						<input
							id="cost"
							name="cost"
							type="number"
							step="0.01"
							min="0"
							required
							bind:value={cost}
							class="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 font-mono shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						/>
					</div>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<!-- Stock -->
					<div>
						<label
							for="stock"
							class="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
						>
							Stock Actual <span class="text-black">*</span>
						</label>
						<input
							id="stock"
							name="stock"
							type="number"
							step="0.001"
							min="0"
							required
							bind:value={stock}
							class="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 font-mono shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						/>
					</div>

					<!-- Min Stock -->
					<div>
						<label
							for="min_stock"
							class="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
						>
							Stock Mínimo (Alerta) <span class="text-black"
								>*</span
							>
						</label>
						<input
							id="min_stock"
							name="min_stock"
							type="number"
							step="0.001"
							min="0"
							required
							bind:value={minStock}
							class="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 font-mono shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						/>
					</div>
				</div>

				<!-- Image URL -->
				<div>
					<label
						for="image_url"
						class="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
					>
						URL de Imagen
					</label>
					<input
						id="image_url"
						name="image_url"
						type="url"
						bind:value={imageUrl}
						placeholder="https://ejemplo.com/producto.jpg"
						class="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
					/>
				</div>

				<!-- Actions -->
				<div
					class="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6"
				>
					<button
						type="button"
						onclick={onClose}
						disabled={submitting}
						class="rounded-lg px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
					>
						Cancelar
					</button>
					<button
						id="btn-submit-product"
						type="submit"
						disabled={submitting}
						class="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-black/90 focus:outline-none disabled:opacity-50 transition-all cursor-pointer"
					>
						{#if submitting}
							<svg
								class="animate-spin -ml-1 mr-1 h-4 w-4 text-white"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8v8H4z"
								></path>
							</svg>
							Guardando...
						{:else}
							{isEditing ? "Guardar Cambios" : "Crear Producto"}
						{/if}
					</button>
				</div>
			</form>
		</div>

		{#if showUnsavedConfirm}
			<div
				class="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
				role="alertdialog"
				aria-labelledby="confirm-unsaved-title"
				aria-describedby="confirm-unsaved-desc"
			>
				<div class="w-full max-w-md rounded-xl bg-white border border-slate-200 p-6 shadow-2xl space-y-4 text-slate-900">
					<div class="flex items-start gap-3 text-amber-600">
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
						</div>
						<div>
							<h3 id="confirm-unsaved-title" class="text-base font-bold text-slate-900">
								Cambios pendientes sin guardar
							</h3>
							<p id="confirm-unsaved-desc" class="text-xs text-slate-500 mt-1 leading-relaxed">
								Tienes modificaciones sin guardar en el producto. Si sales ahora, los cambios se descartarán permanentemente.
							</p>
						</div>
					</div>

					<div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
						<button
							id="btn-continue-editing"
							type="button"
							onclick={() => { showUnsavedConfirm = false; }}
							class="rounded-lg px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
						>
							Continuar Editando
						</button>
						<button
							id="btn-discard-changes"
							type="button"
							onclick={discardAndClose}
							class="rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none transition-all cursor-pointer"
						>
							Descartar y Salir
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}

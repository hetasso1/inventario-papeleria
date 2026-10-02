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
		/** True if a new file has been selected for upload */
		hasNewImage?: boolean;
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
			const hasNewImg = current.hasNewImage ?? false;

			return (
				sku !== '' ||
				name !== '' ||
				desc !== '' ||
				price !== 0 ||
				cost !== 0 ||
				stock !== 0 ||
				minStock !== 5 ||
				img !== '' ||
				hasNewImg
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

		// Image dirty: either a new file was selected, or the URL changed
		if (current.hasNewImage) return true;
		const curImg = (current.imageUrl ?? '').trim();
		const initImg = (initial.image_url ?? '').trim();
		return false;
	}

	/**
	 * Pure function to calculate number input step increment/decrement
	 * following standard HTML input[type=number] step arithmetic.
	 */
	export function stepNumberValue(
		current: number,
		step: number,
		direction: 'up' | 'down'
	): number {
		const factor = Math.round(1 / step);
		const currentScaled = Math.round(current * factor);
		const nextScaled = direction === 'up' ? currentScaled + 1 : currentScaled - 1;
		return Math.max(0, nextScaled / factor);
	}

	export interface ProductValidationResult {
		valid: boolean;
		error?: string;
	}

	/**
	 * Pure function to validate ProductModal inputs before submission.
	 * Replicates and enhances the native HTML validation covered under `novalidate`:
	 * - Required text fields (sku, name)
	 * - Required numeric fields (price, cost, stock, minStock cannot be empty)
	 * - Valid numeric parsing (no NaN)
	 * - Non-negativity constraint (min="0")
	 * - Database capacity limits (NUMERIC overflow prevention)
	 */
	export function validateProductFormInput(values: {
		sku?: string;
		name?: string;
		price?: number | string;
		cost?: number | string;
		stock?: number | string;
		minStock?: number | string;
	}): ProductValidationResult {
		const sku = (values.sku ?? '').trim();
		const name = (values.name ?? '').trim();

		if (!sku || !name) {
			return { valid: false, error: 'Código SKU y Nombre del producto son requeridos.' };
		}

		const pStr = values.price !== undefined ? String(values.price).trim() : '';
		const cStr = values.cost !== undefined ? String(values.cost).trim() : '';
		const sStr = values.stock !== undefined ? String(values.stock).trim() : '';
		const msStr = values.minStock !== undefined ? String(values.minStock).trim() : '';

		if (pStr === '' || cStr === '' || sStr === '' || msStr === '') {
			return { valid: false, error: 'Todos los campos numéricos (precio, costo, stock y stock mínimo) son requeridos.' };
		}

		const p = Number(pStr);
		const c = Number(cStr);
		const s = Number(sStr);
		const ms = Number(msStr);

		if (isNaN(p) || isNaN(c) || isNaN(s) || isNaN(ms)) {
			return { valid: false, error: 'Los valores de precio, costo, stock y stock mínimo deben ser números válidos.' };
		}

		if (p < 0 || c < 0 || s < 0 || ms < 0) {
			return { valid: false, error: 'Los valores numéricos deben ser mayores o iguales a 0.' };
		}

		// Database capacity limits defined in schema (prevent NUMERIC overflow):
		// - price / cost: NUMERIC(10,2) => max 99,999,999.99 (8 integer digits, 2 fractional)
		if (p > 99999999.99 || c > 99999999.99) {
			return { valid: false, error: 'El precio o costo excede el límite máximo permitido ($99,999,999.99).' };
		}

		// - stock / min_stock: NUMERIC(10,3) => max 9,999,999.999 (7 integer digits, 3 fractional)
		if (s > 9999999.999 || ms > 9999999.999) {
			return { valid: false, error: 'El stock o stock mínimo excede el límite máximo permitido (9,999,999.999).' };
		}

		return { valid: true };
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

	// Image state
	let existingImageUrl = $state("");
	let selectedFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let isDragging = $state(false);
	let imageError = $state<string | null>(null);

	/** Max upload size: 5 MB */
	const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
	const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
	const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

	let isDirty = $derived(
		isProductFormDirty(product, {
			sku,
			name,
			description,
			price,
			cost,
			stock,
			minStock,
			imageUrl: existingImageUrl,
			hasNewImage: selectedFile !== null
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
			existingImageUrl = product.image_url ?? "";
		} else {
			sku = "";
			name = "";
			description = "";
			price = 0;
			cost = 0;
			stock = 0;
			minStock = 5;
			existingImageUrl = "";
		}
		selectedFile = null;
		previewUrl = null;
		imageError = null;
		formError = null;
		showUnsavedConfirm = false;
	});

	function validateImageFile(file: File): string | null {
		if (!ACCEPTED_TYPES.includes(file.type)) {
			return `Tipo de archivo no soportado: ${file.type}. Formatos aceptados: JPG, PNG, GIF, WebP, SVG.`;
		}
		if (file.size > MAX_IMAGE_SIZE) {
			return `La imagen excede 5 MB. Tamaño: ${(file.size / 1024 / 1024).toFixed(1)} MB.`;
		}
		const ext = '.' + file.name.split('.').pop()?.toLowerCase();
		if (!ACCEPTED_EXTENSIONS.includes(ext)) {
			return `Extensión no permitida: ${ext}. Extensiones aceptadas: ${ACCEPTED_EXTENSIONS.join(', ')}.`;
		}
		return null;
	}

	function handleFileSelect(file: File) {
		const error = validateImageFile(file);
		if (error) {
			imageError = error;
			return;
		}
		imageError = null;
		selectedFile = file;
		// Create preview URL
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}
		previewUrl = URL.createObjectURL(file);
	}

	function handleDropzoneDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) {
			handleFileSelect(file);
		}
	}

	function handleDropzoneDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDropzoneDragLeave() {
		isDragging = false;
	}

	function handleFileInputChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			handleFileSelect(file);
		}
		// Reset input so the same file can be re-selected
		input.value = '';
	}

	function removeSelectedImage() {
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}
		selectedFile = null;
		previewUrl = null;
		imageError = null;
		existingImageUrl = "";
	}

	/** The image src to display: preview > existing */
	let displayImageSrc = $derived(previewUrl ?? (existingImageUrl || null));

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
				enctype="multipart/form-data"
				novalidate
				use:enhance={({ formData, cancel }) => {
					const validation = validateProductFormInput({
						sku,
						name,
						price,
						cost,
						stock,
						minStock
					});
					if (!validation.valid) {
						formError = validation.error ?? "Datos del producto inválidos.";
						cancel();
						return;
					}
					submitting = true;
					formError = null;
					if (selectedFile) {
						formData.set('image_file', selectedFile);
					}
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

				<!-- Preserve existing image URL if no new file selected -->
				<input type="hidden" name="existing_image_url" value={selectedFile ? '' : existingImageUrl} />

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
							step="0.5"
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
							step="1"
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
							step="1"
							min="0"
							required
							bind:value={minStock}
							class="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 font-mono shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						/>
					</div>
				</div>

				<!-- Image Drag & Drop Zone -->
				<div>
					<span
						class="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
					>
						Imagen del Producto
						<span class="text-slate-400 font-normal normal-case">(Máx. 5 MB — JPG, PNG, GIF, WebP, SVG)</span>
					</span>

					{#if displayImageSrc}
						<!-- Preview with replace/remove controls -->
						<div class="relative rounded-lg border border-slate-200 bg-slate-50 p-3">
							<div class="flex items-center gap-4">
								<div class="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-white border border-slate-200">
									<img
										src={displayImageSrc}
										alt="Preview del producto"
										class="w-full h-full object-contain"
									/>
								</div>
								<div class="flex-1 min-w-0">
									{#if selectedFile}
										<p class="text-sm font-medium text-slate-900 truncate">{selectedFile.name}</p>
										<p class="text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
									{:else}
										<p class="text-sm font-medium text-slate-700">Imagen actual</p>
										<p class="text-xs text-slate-500 truncate">{existingImageUrl}</p>
									{/if}
									<div class="flex gap-2 mt-2">
										<label
											class="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
										>
											<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
											</svg>
											Reemplazar
											<input
												type="file"
												accept={ACCEPTED_TYPES.join(',')}
												onchange={handleFileInputChange}
												class="hidden"
											/>
										</label>
										<button
											type="button"
											onclick={removeSelectedImage}
											class="inline-flex items-center gap-1 rounded-md bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
										>
											<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
											</svg>
											Quitar
										</button>
									</div>
								</div>
							</div>
						</div>
					{:else}
						<!-- Empty dropzone -->
						<div
							id="image-dropzone"
							role="button"
							tabindex="0"
							ondrop={handleDropzoneDrop}
							ondragover={handleDropzoneDragOver}
							ondragleave={handleDropzoneDragLeave}
							class="relative rounded-lg border-2 border-dashed transition-all cursor-pointer
								{isDragging
									? 'border-black bg-slate-100'
									: 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'}"
						>
							<label class="flex flex-col items-center justify-center py-8 px-4 cursor-pointer">
								<svg
									class="h-10 w-10 mb-2 {isDragging ? 'text-black' : 'text-slate-400'}"
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
								<p class="text-sm font-medium text-slate-700">
									{isDragging ? 'Suelta la imagen aquí' : 'Arrastra una imagen aquí'}
								</p>
								<p class="text-xs text-slate-500 mt-1">
									o <span class="text-black font-medium underline">haz clic para seleccionar</span>
								</p>
								<input
									id="image_file"
									name="image_file"
									type="file"
									accept={ACCEPTED_TYPES.join(',')}
									onchange={handleFileInputChange}
									class="hidden"
								/>
							</label>
						</div>
					{/if}

					{#if imageError}
						<p class="mt-1.5 text-xs text-red-600 flex items-center gap-1">
							<svg class="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
							</svg>
							{imageError}
						</p>
					{/if}
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

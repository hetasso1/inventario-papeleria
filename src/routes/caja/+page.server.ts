import { fail, redirect } from '@sveltejs/kit';
import crypto from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';

/**
 * Server-side load and actions for /caja (POS Checkout & Barcode Sales).
 */
export const load: PageServerLoad = async ({ locals, cookies }) => {
	// Guard: Ensure user is authenticated (both admin and cajero are allowed)
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	// Fetch active products for the POS catalog (NO product_costs queried to prevent leaking costs)
	const { data: products, error } = await locals.supabase
		.from('products')
		.select('id, sku_code, name, description, price, stock, min_stock, image_url, is_active')
		.eq('is_active', true)
		.order('name', { ascending: true });

	if (error) {
		return {
			products: [],
			error: 'Error al cargar el catálogo de productos.'
		};
	}

	const sanitizedProducts = (products ?? []).map((p: any) => ({
		id: p.id,
		sku_code: p.sku_code,
		name: p.name,
		description: p.description,
		price: Number(p.price),
		stock: Number(p.stock),
		min_stock: Number(p.min_stock),
		image_url: p.image_url,
		is_active: p.is_active
	}));

	// Derive a stable session identifier tied to the active authentication cookie
	const sessionCookie = cookies?.get ? cookies.get('app_session') : null;
	const sessionId = sessionCookie
		? crypto.createHash('sha256').update(sessionCookie).digest('hex').slice(0, 16)
		: ((locals as any)?.sessionId || (locals?.user as any)?.sessionId || 'default');

	return {
		products: sanitizedProducts,
		user: {
			id: locals.user.id,
			role: locals.role
		},
		sessionId
	};
};

export const actions: Actions = {
	checkout: async ({ request, locals }) => {
		// Strict server authentication check
		if (!locals.user) {
			return fail(401, { error: 'No autorizado. Debe iniciar sesión para realizar ventas.' });
		}

		const formData = await request.formData();
		const itemsRaw = formData.get('items')?.toString();
		let idempotencyKey = formData.get('idempotency_key')?.toString()?.trim();

		// Ensure an idempotency key UUID exists
		if (!idempotencyKey) {
			idempotencyKey = crypto.randomUUID();
		}

		if (!itemsRaw) {
			return fail(400, {
				error: 'El carrito de venta no contiene productos.',
				idempotencyKey
			});
		}

		let parsedItems: Array<{ product_id: string; quantity: number }>;
		try {
			parsedItems = JSON.parse(itemsRaw);
		} catch {
			return fail(400, {
				error: 'Formato de artículos del carrito inválido.',
				idempotencyKey
			});
		}

		if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
			return fail(400, {
				error: 'El carrito debe tener al menos un producto.',
				idempotencyKey
			});
		}

		// Validate each item (product_id non-empty and integer quantity >= 1)
		for (const item of parsedItems) {
			if (!item.product_id || typeof item.product_id !== 'string') {
				return fail(400, {
					error: 'Producto inválido en el carrito.',
					idempotencyKey
				});
			}
			const qty = Number(item.quantity);
			if (isNaN(qty) || !Number.isInteger(qty) || qty < 1) {
				return fail(400, {
					error: 'La cantidad para cada producto debe ser un número entero mayor o igual a 1.',
					idempotencyKey
				});
			}
		}

		// Parse and validate payment details
		const paymentMethodRaw = formData.get('payment_method')?.toString()?.trim();
		const paymentMethod = (paymentMethodRaw || 'EFECTIVO').toUpperCase();
		const cashReceivedRaw = formData.get('cash_received')?.toString()?.trim();
		const cardAmountRaw = formData.get('card_amount')?.toString()?.trim();

		if (!['EFECTIVO', 'TARJETA', 'MIXTO'].includes(paymentMethod)) {
			return fail(400, {
				error: 'Método de pago no válido. Seleccione Efectivo, Tarjeta o Mixto.',
				idempotencyKey
			});
		}

		// Validación preventiva de existencias y cálculo del total estimado con precios oficiales de BD
		const productIds = parsedItems.map((item) => item.product_id);
		const { data: dbProducts } = await locals.supabase
			.from('products')
			.select('id, name, stock, price')
			.in('id', productIds)
			.eq('is_active', true);

		let totalEstimado = 0;
		if (dbProducts && Array.isArray(dbProducts) && dbProducts.length > 0) {
			const stockMap = new Map(
				dbProducts.map((p: any) => [
					p.id,
					{ name: p.name, stock: Number(p.stock), price: Number(p.price) }
				])
			);
			for (const item of parsedItems) {
				const prodInfo = stockMap.get(item.product_id);
				if (!prodInfo) {
					return fail(400, {
						error: 'Producto no encontrado o inactivo en el catálogo.',
						idempotencyKey
					});
				}
				if (item.quantity > prodInfo.stock) {
					return fail(400, {
						error: `Stock insuficiente para "${prodInfo.name}". Disponible: ${prodInfo.stock}, Solicitado: ${item.quantity}.`,
						idempotencyKey
					});
				}
				totalEstimado += Math.round(prodInfo.price * item.quantity * 100) / 100;
			}
		}
		totalEstimado = Math.round(totalEstimado * 100) / 100;

		// Validación preventiva de montos financieros según el método de pago
		let cashReceived = 0;
		let cardAmount = 0;
		let cashAmount = 0;
		let changeAmount = 0;

		if (paymentMethod === 'EFECTIVO') {
			if (cashReceivedRaw !== undefined && cashReceivedRaw !== null && cashReceivedRaw !== '') {
				const val = Number(cashReceivedRaw);
				if (isNaN(val) || val < 0) {
					return fail(400, {
						error: 'El importe de efectivo recibido debe ser un número válido y no negativo.',
						idempotencyKey
					});
				}
				if (totalEstimado > 0 && val < totalEstimado) {
					return fail(400, {
						error: `Efectivo recibido insuficiente ($${val.toFixed(2)}) para cubrir el total ($${totalEstimado.toFixed(2)}).`,
						idempotencyKey
					});
				}
				cashReceived = Math.round(val * 100) / 100;
			} else {
				cashReceived = totalEstimado;
			}
			cashAmount = totalEstimado;
			cardAmount = 0;
			changeAmount = Math.round((cashReceived - totalEstimado) * 100) / 100;
		} else if (paymentMethod === 'TARJETA') {
			cardAmount = totalEstimado;
			cashAmount = 0;
			cashReceived = 0;
			changeAmount = 0;
		} else if (paymentMethod === 'MIXTO') {
			const cardVal = Number(cardAmountRaw);
			if (isNaN(cardVal) || cardVal <= 0) {
				return fail(400, {
					error: 'En pago mixto, el importe de tarjeta debe ser un número positivo.',
					idempotencyKey
				});
			}
			if (totalEstimado > 0 && cardVal >= totalEstimado) {
				return fail(400, {
					error: 'En pago mixto, el importe de tarjeta debe ser menor al total de la venta.',
					idempotencyKey
				});
			}
			cardAmount = Math.round(cardVal * 100) / 100;
			cashAmount = Math.round((totalEstimado - cardAmount) * 100) / 100;

			if (cashReceivedRaw !== undefined && cashReceivedRaw !== null && cashReceivedRaw !== '') {
				const cashVal = Number(cashReceivedRaw);
				if (isNaN(cashVal) || cashVal < 0) {
					return fail(400, {
						error: 'El efectivo recibido en pago mixto debe ser un número válido y no negativo.',
						idempotencyKey
					});
				}
				if (cashVal < cashAmount) {
					return fail(400, {
						error: `Efectivo recibido insuficiente ($${cashVal.toFixed(2)}) para cubrir la porción en efectivo ($${cashAmount.toFixed(2)}).`,
						idempotencyKey
					});
				}
				cashReceived = Math.round(cashVal * 100) / 100;
			} else {
				cashReceived = cashAmount;
			}
			changeAmount = Math.round((cashReceived - cashAmount) * 100) / 100;
		}

		// Validaciones estrictas: no negativos, sin cambio negativo, al menos una forma positiva
		if (cashAmount < 0 || cardAmount < 0 || cashReceived < 0 || changeAmount < 0) {
			return fail(400, {
				error: 'No se permiten importes financieros negativos.',
				idempotencyKey
			});
		}

		if (totalEstimado > 0 && (cashAmount + cardAmount <= 0)) {
			return fail(400, {
				error: 'Debe existir al menos una forma de pago con importe positivo.',
				idempotencyKey
			});
		}

		// Prepare strictly sanitized payload for process_stock_outlet RPC
		// (Notice: client unit prices are completely ignored; DB price is authoritative)
		const rpcItems = parsedItems.map((item) => ({
			product_id: item.product_id,
			quantity: Number(item.quantity)
		}));

		// Si se especificó explícitamente método o detalles de pago, enviamos el payload extendido con metadata;
		// si no (llamadas legacy), enviamos el arreglo directo para compatibilidad.
		const hasExplicitPayment = Boolean(paymentMethodRaw);
		const rpcPayload = hasExplicitPayment
			? {
					items: rpcItems,
					payment_method: paymentMethod,
					cash_amount: cashAmount,
					card_amount: cardAmount,
					cash_received: cashReceived,
					change_amount: changeAmount
				}
			: rpcItems;

		// Invoke atomic & idempotent RPC defined in SRS v8.0 / v8.1
		const { data: outletId, error } = await locals.supabase.rpc('process_stock_outlet', {
			p_items: rpcPayload,
			p_idempotency_key: idempotencyKey
		});

		if (error) {
			// Do not clear cart or lose idempotencyKey on failure (allows retry)
			return fail(400, {
				error: error.message || 'Error al procesar la salida de inventario. Verifique existencias suficientes.',
				idempotencyKey
			});
		}

		return {
			success: true,
			outletId,
			idempotencyKey,
			paymentMethod,
			totalAmount: totalEstimado,
			cashAmount,
			cardAmount,
			cashReceived,
			changeAmount
		};
	}
};

-- Migration: Add payment details to stock_outlets and enhance process_stock_outlet RPC
-- Date: 2026-10-07

-- 1. Alter table stock_outlets to add payment detail columns without altering existing columns
ALTER TABLE stock_outlets
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'EFECTIVO'
    CHECK (payment_method IN ('EFECTIVO', 'TARJETA', 'MIXTO')),
  ADD COLUMN IF NOT EXISTS cash_amount NUMERIC(10, 2) NOT NULL DEFAULT 0
    CHECK (cash_amount >= 0),
  ADD COLUMN IF NOT EXISTS card_amount NUMERIC(10, 2) NOT NULL DEFAULT 0
    CHECK (card_amount >= 0),
  ADD COLUMN IF NOT EXISTS cash_received NUMERIC(10, 2) NOT NULL DEFAULT 0
    CHECK (cash_received >= 0),
  ADD COLUMN IF NOT EXISTS change_amount NUMERIC(10, 2) NOT NULL DEFAULT 0
    CHECK (change_amount >= 0);

-- 2. Redefine process_stock_outlet preserving existing signature & backward compatibility
-- Supports:
-- A) Legacy/simple payload: p_items is a JSONB array of [{ product_id, quantity }, ...]
-- B) Extended payload: p_items is a JSONB object of { items: [...], payment_method, cash_amount, card_amount, cash_received, change_amount }
CREATE OR REPLACE FUNCTION process_stock_outlet(
  p_items JSONB,
  p_idempotency_key UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_outlet_id UUID;
  v_items_array JSONB;
  v_item JSONB;
  v_product_id UUID;
  v_qty NUMERIC(10, 3);
  v_db_price NUMERIC(10, 2);
  v_current_stock NUMERIC(10, 3);
  v_new_stock NUMERIC(10, 3);
  v_total NUMERIC(10, 2) := 0;

  -- Payment fields
  v_payment_method VARCHAR(20) := 'EFECTIVO';
  v_cash_amount NUMERIC(10, 2) := 0;
  v_card_amount NUMERIC(10, 2) := 0;
  v_cash_received NUMERIC(10, 2) := 0;
  v_change_amount NUMERIC(10, 2) := 0;
  v_input_cash_received NUMERIC(10, 2) := NULL;
  v_input_card_amount NUMERIC(10, 2) := 0;
BEGIN
  -- Idempotency check: if key already processed, return existing outlet ID immediately
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_outlet_id FROM stock_outlets WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_outlet_id;
    END IF;
  END IF;

  -- Determine payload structure: object with payment metadata or bare items array
  IF jsonb_typeof(p_items) = 'object' THEN
    v_items_array := p_items->'items';
    v_payment_method := UPPER(COALESCE(p_items->>'payment_method', 'EFECTIVO'));
    IF p_items ? 'cash_received' AND (p_items->>'cash_received') IS NOT NULL THEN
      v_input_cash_received := (p_items->>'cash_received')::NUMERIC(10, 2);
    END IF;
    IF p_items ? 'card_amount' AND (p_items->>'card_amount') IS NOT NULL THEN
      v_input_card_amount := (p_items->>'card_amount')::NUMERIC(10, 2);
    END IF;
  ELSIF jsonb_typeof(p_items) = 'array' THEN
    v_items_array := p_items;
    v_payment_method := 'EFECTIVO';
    v_input_cash_received := NULL;
    v_input_card_amount := 0;
  ELSE
    RAISE EXCEPTION 'Estructura de artículos inválida en process_stock_outlet';
  END IF;

  IF v_items_array IS NULL OR jsonb_array_length(v_items_array) = 0 THEN
    RAISE EXCEPTION 'El carrito de venta no contiene productos';
  END IF;

  -- Validate payment method
  IF v_payment_method NOT IN ('EFECTIVO', 'TARJETA', 'MIXTO') THEN
    RAISE EXCEPTION 'Método de pago no válido: %', v_payment_method;
  END IF;

  -- Insert outlet header with default zero total (atomic transaction)
  INSERT INTO stock_outlets (user_id, total_amount, idempotency_key, payment_method)
  VALUES (auth.uid(), 0, p_idempotency_key, v_payment_method)
  RETURNING id INTO v_outlet_id;

  -- Process line items with lock and validation
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(v_items_array)
    ORDER BY (value->>'product_id')::UUID
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::NUMERIC(10, 3);

    -- Enforce integer quantities >= 1
    IF v_qty IS NULL OR v_qty < 1 OR v_qty != FLOOR(v_qty) THEN
      RAISE EXCEPTION 'Cantidad inválida para producto ID %. La cantidad debe ser un número entero mayor o igual a 1', v_product_id;
    END IF;

    SELECT stock, price INTO v_current_stock, v_db_price
    FROM products WHERE id = v_product_id AND is_active = true
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Producto ID % inactivo o inexistente', v_product_id;
    END IF;

    IF v_current_stock < v_qty THEN
      RAISE EXCEPTION 'Stock insuficiente para ID %. Disponible: %, Solicitado: %',
        v_product_id, v_current_stock, v_qty;
    END IF;

    v_new_stock := v_current_stock - v_qty;

    UPDATE products SET stock = v_new_stock, updated_at = NOW() WHERE id = v_product_id;

    INSERT INTO stock_outlet_items (outlet_id, product_id, quantity, unit_price, subtotal)
    VALUES (v_outlet_id, v_product_id, v_qty, v_db_price, v_qty * v_db_price);

    INSERT INTO inventory_logs (product_id, change_type, previous_stock, new_stock, quantity_changed, reference_id, created_by)
    VALUES (v_product_id, 'VENTA', v_current_stock, v_new_stock, -v_qty, v_outlet_id, auth.uid());

    v_total := v_total + (v_qty * v_db_price);
  END LOOP;

  -- Authoritative financial settlement based on DB v_total
  IF v_payment_method = 'EFECTIVO' THEN
    v_cash_amount := v_total;
    v_card_amount := 0;
    v_cash_received := COALESCE(v_input_cash_received, v_total);

    IF v_cash_received < v_total THEN
      RAISE EXCEPTION 'Efectivo recibido insuficiente: % para un total de %', v_cash_received, v_total;
    END IF;

    v_change_amount := v_cash_received - v_total;

  ELSIF v_payment_method = 'TARJETA' THEN
    v_card_amount := v_total;
    v_cash_amount := 0;
    v_cash_received := 0;
    v_change_amount := 0;

  ELSIF v_payment_method = 'MIXTO' THEN
    IF v_input_card_amount <= 0 OR v_input_card_amount >= v_total THEN
      RAISE EXCEPTION 'Monto de tarjeta inválido para pago mixto: % (total: %)', v_input_card_amount, v_total;
    END IF;

    v_card_amount := v_input_card_amount;
    v_cash_amount := v_total - v_card_amount;
    v_cash_received := COALESCE(v_input_cash_received, v_cash_amount);

    IF v_cash_received < v_cash_amount THEN
      RAISE EXCEPTION 'Efectivo recibido insuficiente en pago mixto: % (monto efectivo requerido: %)', v_cash_received, v_cash_amount;
    END IF;

    v_change_amount := v_cash_received - v_cash_amount;
  END IF;

  -- Defensive check on negative values
  IF v_cash_amount < 0 OR v_card_amount < 0 OR v_cash_received < 0 OR v_change_amount < 0 THEN
    RAISE EXCEPTION 'Importes financieros negativos no permitidos';
  END IF;

  -- Check at least one positive payment amount when total > 0
  IF v_total > 0 AND (v_cash_amount + v_card_amount <= 0) THEN
    RAISE EXCEPTION 'No existe ninguna forma de pago con importe positivo';
  END IF;

  -- Final update of header with official totals and payment details
  UPDATE stock_outlets SET
    total_amount = v_total,
    payment_method = v_payment_method,
    cash_amount = v_cash_amount,
    card_amount = v_card_amount,
    cash_received = v_cash_received,
    change_amount = v_change_amount
  WHERE id = v_outlet_id;

  RETURN v_outlet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Overload with explicit arguments for direct SQL convenience
CREATE OR REPLACE FUNCTION process_stock_outlet(
  p_items JSONB,
  p_idempotency_key UUID,
  p_payment_method VARCHAR,
  p_cash_amount NUMERIC,
  p_card_amount NUMERIC,
  p_cash_received NUMERIC,
  p_change_amount NUMERIC
) RETURNS UUID AS $$
BEGIN
  RETURN process_stock_outlet(
    jsonb_build_object(
      'items', p_items,
      'payment_method', p_payment_method,
      'cash_amount', p_cash_amount,
      'card_amount', p_card_amount,
      'cash_received', p_cash_received,
      'change_amount', p_change_amount
    ),
    p_idempotency_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

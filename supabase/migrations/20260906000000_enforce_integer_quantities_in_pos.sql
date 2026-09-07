-- Migration: Enforce integer quantities >= 1 in process_stock_outlet
-- Redefine process_stock_outlet to reject null, zero, negative or fractional quantities in POS sales.

CREATE OR REPLACE FUNCTION process_stock_outlet(
  p_items JSONB,
  p_idempotency_key UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_outlet_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_qty NUMERIC(10, 3);
  v_db_price NUMERIC(10, 2);
  v_current_stock NUMERIC(10, 3);
  v_new_stock NUMERIC(10, 3);
  v_total NUMERIC(10, 2) := 0;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_outlet_id FROM stock_outlets WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_outlet_id;
    END IF;
  END IF;

  INSERT INTO stock_outlets (user_id, total_amount, idempotency_key)
  VALUES (auth.uid(), 0, p_idempotency_key)
  RETURNING id INTO v_outlet_id;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_items)
    ORDER BY (value->>'product_id')::UUID
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::NUMERIC(10, 3);

    -- Validación estricta de cantidad: entero mayor o igual a 1
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

  UPDATE stock_outlets SET total_amount = v_total WHERE id = v_outlet_id;
  RETURN v_outlet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

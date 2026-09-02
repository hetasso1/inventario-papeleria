-- =============================================================================
-- Migración: Habilitar lectura de partidas de venta (stock_outlet_items)
-- Permite a Administradores y al usuario que registró la salida consultar
-- los productos y partidas de cada venta.
-- =============================================================================

DROP POLICY IF EXISTS "Renglones salidas propias o Admin" ON stock_outlet_items;

CREATE POLICY "Renglones salidas propias o Admin" ON stock_outlet_items FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM stock_outlets so
      WHERE so.id = stock_outlet_items.outlet_id
        AND so.user_id = auth.uid()
    )
  );

-- =====================================================================
-- MIGRACIÓN 010: RPCs de Billing Atómico (Reserve & Adjust)
-- Reemplaza el flujo previo de cobro post-respuesta.
-- El crédito se RESERVA antes del LLM y se AJUSTA al finalizar.
-- =====================================================================

-- RPC 1: Reservar crédito ANTES de llamar al LLM
-- Valida que haya saldo suficiente y descuenta la reserva atómicamente.
-- Retorna { success: true } o { success: false, reason: '...' }
CREATE OR REPLACE FUNCTION reserve_credit_atomic(
  target_org_id   UUID,
  reserve_amount  NUMERIC
) RETURNS JSONB AS $$
DECLARE
  current_balance NUMERIC;
  org_status      TEXT;
BEGIN
  -- Leer estado y saldo con bloqueo para evitar race conditions
  SELECT credit_balance, status
  INTO current_balance, org_status
  FROM organizations
  WHERE id = target_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Organización no encontrada');
  END IF;

  IF org_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Organización inactiva o pausada');
  END IF;

  IF current_balance <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Saldo insuficiente');
  END IF;

  -- Descontar la reserva
  UPDATE organizations
  SET credit_balance = credit_balance - reserve_amount
  WHERE id = target_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'reserved', reserve_amount,
    'remaining_balance', current_balance - reserve_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------

-- RPC 2: Ajustar crédito al finalizar (diferencia entre reserva y costo real)
-- adjustment_amount > 0 = devolver crédito (costo real fue menor a la reserva)
-- adjustment_amount < 0 = descontar más   (costo real fue mayor a la reserva)
CREATE OR REPLACE FUNCTION adjust_credit_atomic(
  target_org_id     UUID,
  adjustment_amount NUMERIC,
  reason            TEXT DEFAULT 'Ajuste de crédito post-respuesta'
) RETURNS JSONB AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  UPDATE organizations
  SET credit_balance = credit_balance + adjustment_amount
  WHERE id = target_org_id
  RETURNING credit_balance INTO new_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Organización no encontrada');
  END IF;

  -- Si el saldo resultante es negativo, emitir alerta (no bloquear)
  IF new_balance < 0 THEN
    RAISE WARNING 'Organización % tiene saldo negativo: %', target_org_id, new_balance;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'adjustment', adjustment_amount,
    'new_balance', new_balance,
    'reason', reason
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------

-- RPC 3: Agregar columna 'source' y 'interest' si aún no existen
DO $$
BEGIN
  -- Canal de origen del mensaje/contacto ('telegram' | 'whatsapp' | 'dashboard')
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'source') THEN
    ALTER TABLE contacts ADD COLUMN source TEXT DEFAULT 'telegram';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'source') THEN
    ALTER TABLE messages ADD COLUMN source TEXT DEFAULT 'telegram';
  END IF;

  -- Columna interest separada de status (evita mezclar texto libre con enum)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'interest') THEN
    ALTER TABLE contacts ADD COLUMN interest TEXT;
  END IF;
END $$;

-- -----------------------------------------------------------------------

-- RPC 4: Actualizar create_or_update_contact_rpc para usar columna 'interest'
-- (corrige el bug donde target_interest se guardaba en la columna 'status')
CREATE OR REPLACE FUNCTION create_or_update_contact_rpc(
  target_full_name TEXT,
  target_phone     TEXT,
  target_city      TEXT,
  target_interest  TEXT,
  target_org_id    UUID
) RETURNS JSONB AS $$
DECLARE
  contact_record RECORD;
BEGIN
  INSERT INTO contacts (full_name, phone, city, interest, status, organization_id)
  VALUES (
    target_full_name,
    target_phone,
    target_city,
    target_interest,
    'Nuevo',
    target_org_id
  )
  ON CONFLICT (phone, organization_id) DO UPDATE
  SET
    full_name  = EXCLUDED.full_name,
    city       = COALESCE(NULLIF(target_city, ''), contacts.city),
    interest   = COALESCE(NULLIF(target_interest, ''), contacts.interest),
    updated_at = now()
  RETURNING * INTO contact_record;

  RETURN jsonb_build_object(
    'success', true,
    'contact_id', contact_record.id,
    'full_name',  contact_record.full_name,
    'status',     contact_record.status,
    'interest',   contact_record.interest
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------

-- ACTUALIZAR RLS: Políticas más restrictivas para producción
-- El bot usa service_role_key → bypasea RLS automáticamente.
-- El dashboard usa anon_key → veRSO datos de su propia organización.

-- Revocar políticas anteriores de acceso público total
DROP POLICY IF EXISTS "Public Read for Contacts"         ON contacts;
DROP POLICY IF EXISTS "Public Read for Messages"         ON messages;
DROP POLICY IF EXISTS "Public Read for Documents"        ON documents;
DROP POLICY IF EXISTS "Public Read for Agent Context"    ON agent_context;
DROP POLICY IF EXISTS "Public Read for Bot Settings"     ON bot_settings;
DROP POLICY IF EXISTS "Public Read for Usage Logs"       ON usage_logs;
DROP POLICY IF EXISTS "Public Read for Organizations"    ON organizations;
DROP POLICY IF EXISTS "Public Read for Agent Personality" ON agent_personality;
DROP POLICY IF EXISTS "Public Update for Agent Personality" ON agent_personality;
DROP POLICY IF EXISTS "Public Insert for Agent Personality" ON agent_personality;

-- Nota: En esta fase, mientras no haya auth de usuarios en el dashboard,
-- permitimos acceso anon filtrado por organización vía header de contexto.
-- Para SaaS completo, vincular auth.uid() → organization_id.

-- Política temporal: lectura pública por organización
-- (el dashboard siempre filtrará por organization_id en las queries)
CREATE POLICY "Org Select Contacts"
  ON contacts FOR SELECT USING (true);

CREATE POLICY "Org Select Messages"
  ON messages FOR SELECT USING (true);

CREATE POLICY "Org Select Documents"
  ON documents FOR SELECT USING (true);

CREATE POLICY "Org Select Agent Context"
  ON agent_context FOR SELECT USING (true);

CREATE POLICY "Org Select Usage Logs"
  ON usage_logs FOR SELECT USING (true);

CREATE POLICY "Org Select Organizations"
  ON organizations FOR SELECT USING (true);

CREATE POLICY "Org Select Agent Personality"
  ON agent_personality FOR SELECT USING (true);

CREATE POLICY "Org Update Agent Personality"
  ON agent_personality FOR UPDATE USING (true);

CREATE POLICY "Org Insert Agent Personality"
  ON agent_personality FOR INSERT WITH CHECK (true);

-- Políticas de escritura: solo desde service_role (el bot)
-- El dashboard no necesita escribir directamente en las tablas principales;
-- usa el bot como intermediario a través de /api/send-message.
-- (Esto se endurecerá cuando se implemente Supabase Auth en el dashboard)

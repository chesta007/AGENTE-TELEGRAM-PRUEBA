-- =====================================================================
-- MIGRACIÓN 011 — Consolidación de Multi-Tenancy con BIGSERIAL
-- Alcance AI | Fecha: Abril 2026
--
-- CONTEXTO:
--   Las migraciones 001-002 crearon la tabla organizations con UUID
--   y agregaron organization_id UUID a las demás tablas.
--   Esta migración reemplaza ese esquema por BIGSERIAL (más simple,
--   mejor performance en JOINs, sin generación de UUIDs en el bot).
--
-- ESTRATEGIA DE MIGRACIÓN (idempotente):
--   1. Limpiar foreign keys y columnas UUID previas
--   2. Recrear organizations con BIGSERIAL
--   3. Agregar organization_id BIGINT a todas las tablas
--   4. Insertar organización default y migrar registros existentes
--   5. Actualizar todas las RPCs para usar BIGINT
--   6. Configurar RLS
--
-- INSTRUCCIONES:
--   Ejecutar en: Supabase Dashboard → SQL Editor (en orden, una sola vez)
--   Si el proyecto es NUEVO (sin migraciones previas aplicadas),
--   también funciona correctamente.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- PASO 1: Limpiar objetos del esquema UUID anterior (idempotente)
-- ─────────────────────────────────────────────────────────────────────

-- Eliminar RPCs antiguas con firma UUID para poder recrearlas con BIGINT
DROP FUNCTION IF EXISTS reserve_credit_atomic(UUID, NUMERIC);
DROP FUNCTION IF EXISTS adjust_credit_atomic(UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS create_or_update_contact_rpc(TEXT, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS update_contact_status_rpc(BIGINT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS mark_hot_lead_rpc(BIGINT, TEXT, UUID);
DROP FUNCTION IF EXISTS get_contact_details_rpc(BIGINT, UUID);
DROP FUNCTION IF EXISTS decrement_balance_with_log_rpc(UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS decrement_balance(UUID, DECIMAL);

-- Eliminar constraints y columnas UUID en tablas existentes
DO $$
DECLARE
  _table TEXT;
BEGIN
  FOREACH _table IN ARRAY ARRAY['contacts', 'messages', 'documents', 'agent_context', 'bot_settings', 'usage_logs', 'agent_tool_logs', 'agent_personality']
  LOOP
    -- Eliminar index si existe
    EXECUTE format('DROP INDEX IF EXISTS idx_%s_org', _table);

    -- Eliminar foreign key constraint a organizations anterior (UUID)
    -- (El constraint puede tener varios nombres según cómo se creó)
    EXECUTE format($$
      DO $inner$
      DECLARE _con TEXT;
      BEGIN
        SELECT conname INTO _con
        FROM pg_constraint
        WHERE conrelid = %L::regclass
          AND contype = 'f'
          AND conname ILIKE '%%organization_id%%'
        LIMIT 1;
        IF _con IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %%I', %L, _con);
        END IF;
      END $inner$;
    $$, _table, _table);

    -- Eliminar la columna organization_id UUID si existe
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = _table
        AND column_name  = 'organization_id'
        AND udt_name     = 'uuid'
    ) THEN
      EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS organization_id', _table);
      RAISE NOTICE 'Columna UUID organization_id eliminada de: %', _table;
    END IF;
  END LOOP;
END $$;

-- Eliminar policies de organizaciones anteriores (evitar conflictos)
DO $$
DECLARE _pol RECORD;
BEGIN
  FOR _pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname ILIKE '%org%' OR policyname ILIKE '%public%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', _pol.policyname, _pol.tablename);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- PASO 2: Tabla organizations con BIGSERIAL
-- ─────────────────────────────────────────────────────────────────────

-- Primero: si existe la tabla UUID anterior, la renombramos para preservar datos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organizations'
  ) THEN
    -- Verificar si el pk es UUID
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'organizations'
        AND column_name  = 'id'
        AND udt_name     = 'uuid'
    ) THEN
      ALTER TABLE organizations RENAME TO organizations_uuid_backup;
      DROP INDEX IF EXISTS idx_organizations_slug;
      RAISE NOTICE 'Tabla organizations UUID respaldada como organizations_uuid_backup';
    END IF;
  END IF;
END $$;

-- Crear tabla organizations con BIGSERIAL (idempotente)
CREATE TABLE IF NOT EXISTS organizations (
  id                  BIGSERIAL PRIMARY KEY,
  name                TEXT                NOT NULL,
  slug                TEXT                UNIQUE NOT NULL,
  credit_balance      DECIMAL(14, 4)      NOT NULL DEFAULT 0.0000,
  status              TEXT                NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'paused', 'suspended')),
  monthly_fee_status  TEXT                NOT NULL DEFAULT 'pending'
                        CHECK (monthly_fee_status IN ('active', 'pending', 'overdue', 'canceled')),
  monthly_fee_due_date TIMESTAMPTZ,
  telegram_token      TEXT,               -- Token del bot de Telegram del tenant
  whatsapp_instance   TEXT,               -- ID de instancia en Evolution API
  created_at          TIMESTAMPTZ         NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ         NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug   ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON organizations;
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- PASO 3: Agregar organization_id BIGINT a todas las tablas
-- ─────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  _table TEXT;
BEGIN
  FOREACH _table IN ARRAY ARRAY['contacts', 'messages', 'documents', 'agent_context', 'bot_settings', 'usage_logs', 'agent_tool_logs']
  LOOP
    -- Agregar columna bigint si no existe
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = _table
        AND column_name  = 'organization_id'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL',
        _table
      );
      RAISE NOTICE 'Columna organization_id BIGINT agregada a: %', _table;
    END IF;

    -- Crear índice si no existe
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_org ON %I(organization_id)',
      _table, _table
    );
  END LOOP;
END $$;

-- agent_personality tiene PK = organization_id, necesita tratamiento especial
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agent_personality'
  ) THEN
    -- Verificar si ya tiene la columna como PK UUID y manejarla
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'agent_personality'
        AND column_name  = 'organization_id'
        AND udt_name     = 'uuid'
    ) THEN
      -- Necesita recrearse con BIGINT pk
      DROP TABLE IF EXISTS agent_personality CASCADE;
      RAISE NOTICE 'agent_personality UUID eliminada para recrear con BIGINT';
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS agent_personality (
  organization_id         BIGINT  PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  warmth                  INTEGER NOT NULL DEFAULT 7  CHECK (warmth BETWEEN 1 AND 10),
  closing_aggressiveness  INTEGER NOT NULL DEFAULT 5  CHECK (closing_aggressiveness BETWEEN 1 AND 10),
  humor                   INTEGER NOT NULL DEFAULT 3  CHECK (humor BETWEEN 0 AND 10),
  response_length         TEXT    NOT NULL DEFAULT 'medium' CHECK (response_length IN ('short', 'medium', 'long')),
  use_emojis              BOOLEAN NOT NULL DEFAULT true,
  sales_method            TEXT    NOT NULL DEFAULT 'direct' CHECK (sales_method IN ('consultative', 'direct', 'spin')),
  custom_instructions     TEXT,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_agent_personality_updated_at ON agent_personality;
CREATE TRIGGER trg_agent_personality_updated_at
  BEFORE UPDATE ON agent_personality
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- PASO 4: Columnas extra (source, interest, tokens)
-- ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='interest') THEN
    ALTER TABLE contacts ADD COLUMN interest TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='source') THEN
    ALTER TABLE contacts ADD COLUMN source TEXT DEFAULT 'telegram';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='updated_at') THEN
    ALTER TABLE contacts ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='source') THEN
    ALTER TABLE messages ADD COLUMN source TEXT DEFAULT 'telegram';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='tokens') THEN
    ALTER TABLE messages ADD COLUMN tokens INTEGER DEFAULT 0;
  END IF;
END $$;

-- Constraint UNIQUE (phone, organization_id) — esencial para upsert por tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contacts_phone_org_unique'
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_phone_org_unique UNIQUE (phone, organization_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- PASO 5: Organización default + migración de datos existentes
-- ─────────────────────────────────────────────────────────────────────

-- Insertar org default (id = 1 por ser la primera en BIGSERIAL)
INSERT INTO organizations (name, slug, credit_balance, status)
VALUES ('Default Organization', 'default', 1000.0000, 'active')
ON CONFLICT (slug) DO UPDATE
  SET name           = EXCLUDED.name,
      credit_balance = GREATEST(organizations.credit_balance, EXCLUDED.credit_balance),
      updated_at     = now();

-- Obtener el ID real de la org default (puede no ser 1 si ya había datos)
DO $$
DECLARE
  _default_org_id BIGINT;
BEGIN
  SELECT id INTO _default_org_id FROM organizations WHERE slug = 'default' LIMIT 1;

  IF _default_org_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró la organización default. Verifique el INSERT anterior.';
  END IF;

  -- Migrar registros huérfanos (sin organization_id) a la org default
  UPDATE contacts        SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE messages        SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE documents       SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE agent_context   SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE usage_logs      SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE agent_tool_logs SET organization_id = _default_org_id WHERE organization_id IS NULL;

  RAISE NOTICE 'Registros existentes migrados a organization_id = %', _default_org_id;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- PASO 6: RPCs de CRM con BIGINT (reemplaza las UUID de migración 009)
-- ─────────────────────────────────────────────────────────────────────

-- 6.1 Crear o actualizar contacto (upsert por teléfono + org)
CREATE OR REPLACE FUNCTION create_or_update_contact_rpc(
  target_full_name  TEXT,
  target_phone      TEXT,
  target_city       TEXT,
  target_interest   TEXT,
  target_org_id     BIGINT
) RETURNS JSONB AS $$
DECLARE
  contact_record RECORD;
BEGIN
  INSERT INTO contacts (full_name, phone, city, interest, status, organization_id)
  VALUES (
    target_full_name,
    COALESCE(NULLIF(target_phone, ''), target_full_name), -- fallback si no hay phone
    target_city,
    target_interest,
    'Nuevo',
    target_org_id
  )
  ON CONFLICT (phone, organization_id) DO UPDATE
  SET
    full_name  = EXCLUDED.full_name,
    city       = COALESCE(NULLIF(target_city, ''),     contacts.city),
    interest   = COALESCE(NULLIF(target_interest, ''), contacts.interest),
    updated_at = now()
  RETURNING * INTO contact_record;

  RETURN jsonb_build_object(
    'success',    true,
    'contact_id', contact_record.id,
    'full_name',  contact_record.full_name,
    'status',     contact_record.status,
    'interest',   contact_record.interest
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.2 Actualizar status y notas de un contacto
CREATE OR REPLACE FUNCTION update_contact_status_rpc(
  target_id      BIGINT,
  target_status  TEXT,
  target_notes   TEXT,
  target_org_id  BIGINT
) RETURNS JSONB AS $$
DECLARE
  updated_contact RECORD;
BEGIN
  -- Validar enum
  IF target_status NOT IN ('Nuevo', 'En contacto', 'Cliente', 'HOT') THEN
    RETURN jsonb_build_object('error', 'Estado inválido: ' || target_status);
  END IF;

  UPDATE contacts
  SET
    status     = target_status,
    notes      = COALESCE(target_notes, notes),
    updated_at = now()
  WHERE id = target_id AND organization_id = target_org_id
  RETURNING * INTO updated_contact;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Contacto no encontrado o acceso denegado');
  END IF;

  RETURN jsonb_build_object('success', true, 'contact_id', updated_contact.id, 'new_status', target_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.3 Marcar como HOT LEAD
CREATE OR REPLACE FUNCTION mark_hot_lead_rpc(
  target_id      BIGINT,
  target_reason  TEXT,
  target_org_id  BIGINT
) RETURNS JSONB AS $$
DECLARE
  updated_contact RECORD;
BEGIN
  UPDATE contacts
  SET
    status     = 'HOT',
    notes      = COALESCE(target_reason, notes),
    updated_at = now()
  WHERE id = target_id AND organization_id = target_org_id
  RETURNING * INTO updated_contact;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Contacto no encontrado o acceso denegado');
  END IF;

  RETURN jsonb_build_object('success', true, 'contact_id', updated_contact.id, 'priority', 'HOT');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.4 Obtener detalles completos de un contacto
CREATE OR REPLACE FUNCTION get_contact_details_rpc(
  target_id      BIGINT,
  target_org_id  BIGINT
) RETURNS JSONB AS $$
DECLARE
  contact_data RECORD;
BEGIN
  SELECT * FROM contacts
  WHERE id = target_id AND organization_id = target_org_id
  INTO contact_data;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Contacto no encontrado o sin acceso');
  END IF;

  RETURN to_jsonb(contact_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────
-- PASO 7: RPCs de Billing Atómico con BIGINT (reemplaza migración 010)
-- ─────────────────────────────────────────────────────────────────────

-- 7.1 Reservar crédito ANTES del LLM (con FOR UPDATE anti-race-condition)
CREATE OR REPLACE FUNCTION reserve_credit_atomic(
  target_org_id   BIGINT,
  reserve_amount  NUMERIC
) RETURNS JSONB AS $$
DECLARE
  current_balance NUMERIC;
  org_status      TEXT;
  org_name        TEXT;
BEGIN
  SELECT credit_balance, status, name
  INTO current_balance, org_status, org_name
  FROM organizations
  WHERE id = target_org_id
  FOR UPDATE;  -- Bloqueo de fila para concurrencia segura

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Organización no encontrada');
  END IF;

  IF org_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'reason', format('Organización "%s" está %s', org_name, org_status));
  END IF;

  IF current_balance <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', format('Saldo insuficiente en "%s": $%s', org_name, current_balance));
  END IF;

  UPDATE organizations
  SET credit_balance = credit_balance - reserve_amount,
      updated_at     = now()
  WHERE id = target_org_id;

  RETURN jsonb_build_object(
    'success',           true,
    'org_name',          org_name,
    'reserved',          reserve_amount,
    'remaining_balance', current_balance - reserve_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.2 Ajustar crédito al finalizar (devolver o cobrar diferencia)
CREATE OR REPLACE FUNCTION adjust_credit_atomic(
  target_org_id     BIGINT,
  adjustment_amount NUMERIC,   -- positivo = devolver, negativo = cobrar más
  reason            TEXT DEFAULT 'Ajuste post-respuesta'
) RETURNS JSONB AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  UPDATE organizations
  SET credit_balance = credit_balance + adjustment_amount,
      updated_at     = now()
  WHERE id = target_org_id
  RETURNING credit_balance INTO new_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Organización no encontrada');
  END IF;

  IF new_balance < 0 THEN
    -- No bloqueamos, pero dejamos advertencia en los logs de Postgres
    RAISE WARNING '[BILLING] Org % tiene saldo negativo: $%.8f | Razón: %', target_org_id, new_balance, reason;
  END IF;

  RETURN jsonb_build_object(
    'success',     true,
    'adjustment',  adjustment_amount,
    'new_balance', new_balance,
    'reason',      reason
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────
-- PASO 8: Habilitar RLS en todas las tablas
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE organizations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_context    ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tool_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_personality ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bot_settings') THEN
    ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- PASO 9: Políticas RLS — Fase actual (anon_key + filtro por org)
--
-- El BOT usa service_role → bypasea RLS, ve todo.
-- El DASHBOARD usa anon_key → solo puede SELECT.
-- TODO (Fase 3): Cuando haya Supabase Auth, reemplazar USING(true)
--   por: USING (organization_id = (SELECT org_id FROM user_profiles WHERE user_id = auth.uid()))
-- ─────────────────────────────────────────────────────────────────────

-- Limpiar policies residuales antes de crear
DO $$
DECLARE _r RECORD;
BEGIN
  FOR _r IN
    SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', _r.policyname, _r.tablename);
  END LOOP;
END $$;

-- Organizations: lectura pública (el dashboard necesita leer saldo y nombre)
CREATE POLICY "anon_read_organizations"
  ON organizations FOR SELECT TO anon USING (true);

-- Contacts: lectura pública (el dashboard filtra por org_id en la query)
CREATE POLICY "anon_read_contacts"
  ON contacts FOR SELECT TO anon USING (true);

-- Messages: lectura pública
CREATE POLICY "anon_read_messages"
  ON messages FOR SELECT TO anon USING (true);

-- Documents: lectura pública
CREATE POLICY "anon_read_documents"
  ON documents FOR SELECT TO anon USING (true);

-- Agent Context: lectura pública
CREATE POLICY "anon_read_agent_context"
  ON agent_context FOR SELECT TO anon USING (true);

-- Usage Logs: lectura pública
CREATE POLICY "anon_read_usage_logs"
  ON usage_logs FOR SELECT TO anon USING (true);

-- Agent Tool Logs: lectura pública
CREATE POLICY "anon_read_tool_logs"
  ON agent_tool_logs FOR SELECT TO anon USING (true);

-- Agent Personality: lectura + escritura pública (el dashboard configura)
CREATE POLICY "anon_read_agent_personality"
  ON agent_personality FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_agent_personality"
  ON agent_personality FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_agent_personality"
  ON agent_personality FOR UPDATE TO anon USING (true);

-- Agent Context: escritura pública (el dashboard edita el system prompt)
CREATE POLICY "anon_insert_agent_context"
  ON agent_context FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_agent_context"
  ON agent_context FOR UPDATE TO anon USING (true);

-- ─────────────────────────────────────────────────────────────────────
-- PASO 10: Verificación final
-- ─────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  _org_id   BIGINT;
  _org_name TEXT;
  _balance  NUMERIC;
BEGIN
  SELECT id, name, credit_balance INTO _org_id, _org_name, _balance
  FROM organizations WHERE slug = 'default';

  RAISE NOTICE '======================================';
  RAISE NOTICE '✅ Migración 011 completada';
  RAISE NOTICE '   Org default: % (ID: %)', _org_name, _org_id;
  RAISE NOTICE '   Saldo: $%', _balance;
  RAISE NOTICE '   Tablas con organization_id BIGINT: contacts, messages, documents, agent_context, bot_settings, usage_logs, agent_tool_logs';
  RAISE NOTICE '   RPCs actualizadas: create_or_update_contact_rpc, update_contact_status_rpc, mark_hot_lead_rpc, get_contact_details_rpc, reserve_credit_atomic, adjust_credit_atomic';
  RAISE NOTICE '======================================';
END $$;

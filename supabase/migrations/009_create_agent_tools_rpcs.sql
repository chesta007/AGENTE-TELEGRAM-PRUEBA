-- 1. RPC para crear o actualizar un contacto de forma atómica (Evita duplicados por organización)
CREATE OR REPLACE FUNCTION create_or_update_contact_rpc(
  target_full_name TEXT,
  target_phone TEXT,
  target_city TEXT,
  target_interest TEXT,
  target_org_id UUID
) RETURNS JSONB AS $$
DECLARE
  contact_record RECORD;
BEGIN
  -- Insertamos o actualizamos basándonos en el teléfono dentro de la misma organización
  INSERT INTO contacts (full_name, phone, city, status, organization_id)
  VALUES (target_full_name, target_phone, target_city, COALESCE(target_interest, 'Nuevo'), target_org_id)
  ON CONFLICT (phone, organization_id) DO UPDATE
  SET 
    full_name = EXCLUDED.full_name,
    city = COALESCE(target_city, contacts.city),
    status = COALESCE(target_interest, contacts.status),
    updated_at = now()
  RETURNING * INTO contact_record;

  RETURN jsonb_build_object('success', true, 'contact_id', contact_record.id, 'full_name', contact_record.full_name, 'status', contact_record.status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC para actualizar el estatus y notas de un contacto de forma segura
CREATE OR REPLACE FUNCTION update_contact_status_rpc(
  target_id BIGINT,
  target_status TEXT,
  target_notes TEXT,
  target_org_id UUID
) RETURNS JSONB AS $$
DECLARE
  updated_contact RECORD;
BEGIN
  UPDATE contacts
  SET status = target_status, notes = COALESCE(target_notes, notes), updated_at = now()
  WHERE id = target_id AND organization_id = target_org_id
  RETURNING * INTO updated_contact;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Contacto no encontrado o acceso denegado a la organización');
  END IF;

  RETURN jsonb_build_object('success', true, 'contact_id', updated_contact.id, 'new_status', target_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC para marcar un contacto como prioritario (HOT LEAD)
CREATE OR REPLACE FUNCTION mark_hot_lead_rpc(
  target_id BIGINT,
  target_reason TEXT,
  target_org_id UUID
) RETURNS JSONB AS $$
DECLARE
  updated_contact RECORD;
BEGIN
  UPDATE contacts
  SET status = 'HOT', notes = target_reason, updated_at = now()
  WHERE id = target_id AND organization_id = target_org_id
  RETURNING * INTO updated_contact;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Error al priorizar contacto');
  END IF;

  RETURN jsonb_build_object('success', true, 'contact_id', updated_contact.id, 'priority', 'HOT');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC para obtener detalles completos de un contacto (Inspección del bot)
CREATE OR REPLACE FUNCTION get_contact_details_rpc(
  target_id BIGINT,
  target_org_id UUID
) RETURNS JSONB AS $$
DECLARE
  contact_data RECORD;
BEGIN
  SELECT * FROM contacts
  WHERE id = target_id AND organization_id = target_org_id
  INTO contact_data;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sin acceso a los detalles del contacto');
  END IF;

  RETURN to_jsonb(contact_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC para descuento de balance atómico con validación de organización
CREATE OR REPLACE FUNCTION decrement_balance_with_log_rpc(
  target_org_id UUID,
  target_amount NUMERIC,
  target_reason TEXT
) RETURNS JSONB AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  -- Restamos el balance
  UPDATE organizations
  SET credit_balance = credit_balance - target_amount
  WHERE id = target_org_id
  RETURNING credit_balance INTO current_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Organización no encontrada');
  END IF;

  RETURN jsonb_build_object('success', true, 'remaining_balance', current_balance, 'charge', target_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Garantizar el constraint de unicidad (Teléfono + Org)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_phone_org_unique') THEN
        ALTER TABLE contacts ADD CONSTRAINT contacts_phone_org_unique UNIQUE (phone, organization_id);
    END IF;
END $$;

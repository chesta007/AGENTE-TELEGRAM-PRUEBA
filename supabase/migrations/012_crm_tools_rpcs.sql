-- Migración 012: RPCs para CRM Tools con soporte BIGINT y Multi-Tenancy
-- Alcance AI | Senior Backend Engineer

-- 1. Get Contact Details
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
    RETURN jsonb_build_object('error', 'Contacto no encontrado o sin acceso para la organización ' || target_org_id);
  END IF;

  RETURN to_jsonb(contact_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Contact Status
CREATE OR REPLACE FUNCTION update_contact_status_rpc(
  target_id      BIGINT,
  target_status  TEXT,
  target_notes   TEXT,
  target_org_id  BIGINT
) RETURNS JSONB AS $$
DECLARE
  updated_contact RECORD;
BEGIN
  UPDATE contacts
  SET
    status     = target_status,
    notes      = COALESCE(target_notes, notes),
    updated_at = now()
  WHERE id = target_id AND organization_id = target_org_id
  RETURNING * INTO updated_contact;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Error al actualizar status: no se encontró contacto ' || target_id || ' para la organización ' || target_org_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'contact_id', updated_contact.id, 'new_status', target_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Mark Hot Lead
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
    RETURN jsonb_build_object('error', 'Error al marcar HOT Lead: contacto ' || target_id || ' no encontrado en org ' || target_org_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'contact_id', updated_contact.id, 'priority', 'HOT');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create or Update Contact
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
    COALESCE(NULLIF(target_phone, ''), target_full_name),
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

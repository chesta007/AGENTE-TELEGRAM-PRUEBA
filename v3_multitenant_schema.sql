-- ============================================================
-- ALCANCE AI - ARCHITECTURE V3 (MULTI-TENANT & MULTI-CHANNEL)
-- ============================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    credit_balance DECIMAL(12, 4) DEFAULT 10.00,
    status TEXT DEFAULT 'active', -- active, paused, suspended
    whatsapp_instance_id TEXT, -- Para Evolution API
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. UPDATING CONTACTS TABLE
DO $$ 
BEGIN
    -- Añadir organization_id si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='organization_id') THEN
        ALTER TABLE contacts ADD COLUMN organization_id BIGINT REFERENCES organizations(id);
    END IF;
    
    -- Añadir lead_stage si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='lead_stage') THEN
        ALTER TABLE contacts ADD COLUMN lead_stage TEXT DEFAULT 'new'; -- 'new', 'qualified', 'interested', 'hot', 'closed', 'lost'
    END IF;

    -- Añadir source si no existe (indicador de origen del lead inicial)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='source') THEN
        ALTER TABLE contacts ADD COLUMN source TEXT; -- 'telegram', 'whatsapp', etc.
    END IF;
END $$;

-- 4. MESSAGES TABLE (UNIFIED INBOX)
-- Si ya existe, podemos renombrar o migrar, pero aquí la definimos robusta
DROP TABLE IF EXISTS messages CASCADE;
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id BIGINT REFERENCES organizations(id),
    contact_id UUID REFERENCES contacts(id),
    content TEXT NOT NULL,
    sender TEXT NOT NULL, -- 'user', 'agent', 'system'
    channel TEXT NOT NULL, -- 'telegram', 'whatsapp', 'messenger', 'instagram'
    tokens INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. USAGE LOGS (BILLING)
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id BIGINT REFERENCES organizations(id),
    tokens_used INTEGER NOT NULL,
    cost_usd DECIMAL(12, 8) NOT NULL,
    model_used TEXT NOT NULL,
    message_id UUID REFERENCES messages(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. BOT SETTINGS (PERSONALITY & CONFIG - Ex-agent_personality)
CREATE TABLE IF NOT EXISTS bot_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id BIGINT REFERENCES organizations(id) UNIQUE,
    system_prompt TEXT,
    warmth INTEGER DEFAULT 7,
    humor INTEGER DEFAULT 3,
    closing_aggressiveness INTEGER DEFAULT 5,
    use_emojis BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. DOCUMENTS (KNOWLEDGE BASE)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='organization_id') THEN
        ALTER TABLE documents ADD COLUMN organization_id BIGINT REFERENCES organizations(id);
    END IF;
END $$;

-- ============================================================
-- STORED PROCEDURES (RPCs) - ATOMIC MULTI-TENANCY
-- ============================================================

-- A. RESERVAR CRÉDITO (ATÓMICO)
CREATE OR REPLACE FUNCTION reserve_credit_atomic(target_org_id BIGINT, reserve_amount DECIMAL)
RETURNS JSONB AS $$
DECLARE
    current_balance DECIMAL;
BEGIN
    SELECT credit_balance INTO current_balance FROM organizations WHERE id = target_org_id FOR UPDATE;
    
    IF current_balance >= reserve_amount THEN
        UPDATE organizations SET credit_balance = credit_balance - reserve_amount WHERE id = target_org_id;
        RETURN jsonb_build_object('success', true, 'remaining', current_balance - reserve_amount);
    ELSE
        RETURN jsonb_build_object('success', false, 'reason', 'Crédito insuficiente', 'balance', current_balance);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- B. AJUSTAR CRÉDITO (DEVOLVER O COBRAR EXTRA)
CREATE OR REPLACE FUNCTION adjust_credit_atomic(target_org_id BIGINT, adjustment_amount DECIMAL, reason TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE organizations SET credit_balance = credit_balance + adjustment_amount WHERE id = target_org_id;
END;
$$ LANGUAGE plpgsql;

-- C. ACTUALIZAR ESTADO DEL LEAD (Lead Stage)
CREATE OR REPLACE FUNCTION update_lead_stage_rpc(target_id UUID, target_stage TEXT, target_org_id BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE contacts 
    SET lead_stage = target_stage 
    WHERE id = target_id AND organization_id = target_org_id;
END;
$$ LANGUAGE plpgsql;

-- Insert de organización inicial para evitar errores en bot inicial
INSERT INTO organizations (name, slug, credit_balance)
VALUES ('Alcance AI Demo', 'default', 10.00)
ON CONFLICT (slug) DO NOTHING;

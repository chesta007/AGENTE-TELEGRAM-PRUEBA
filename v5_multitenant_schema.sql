-- ============================================================
-- ALCANCE AI - ARCHITECTURE V5 (PREMIUM MULTI-TENANT & CHANNEL)
-- ============================================================

-- 1. EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_channel') THEN
        CREATE TYPE message_channel AS ENUM ('telegram', 'whatsapp', 'messenger', 'instagram');
    END IF;
END $$;

-- 2. ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    credit_balance DECIMAL(12, 4) DEFAULT 10.00,
    status TEXT DEFAULT 'active', -- active, paused, suspended
    monthly_fee_status TEXT DEFAULT 'paid', -- paid, unpaid, trial
    whatsapp_instance_id TEXT, -- Evolution API Instance
    preferred_llm TEXT DEFAULT 'meta-llama/llama-3.1-8b-instruct',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. UPDATING CORE TABLES WITH organization_id
-- CONTACTS
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='organization_id') THEN
        ALTER TABLE contacts ADD COLUMN organization_id UUID REFERENCES organizations(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='lead_stage') THEN
        ALTER TABLE contacts ADD COLUMN lead_stage TEXT DEFAULT 'new';
    END IF;
END $$;

-- MESSAGES (V5: Lead stage snapshot and channel tracking)
-- Recreamos messages para asegurar integridad de columnas
DROP TABLE IF EXISTS messages CASCADE;
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    contact_id UUID REFERENCES contacts(id),
    content TEXT NOT NULL,
    sender TEXT NOT NULL, -- 'user', 'agent', 'system'
    channel TEXT NOT NULL, -- 'telegram', 'whatsapp', 'messenger', 'instagram'
    lead_stage TEXT, -- Snapshot del stage en este mensaje
    external_id TEXT, -- ID del mensaje en la plataforma origen
    tokens INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USAGE LOGS (V5: Channel and billing)
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    tokens_used INTEGER NOT NULL,
    cost_usd DECIMAL(12, 8) NOT NULL,
    model_used TEXT NOT NULL,
    channel TEXT, -- Canal consumido
    message_id UUID REFERENCES messages(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- BOT SETTINGS (V5)
CREATE TABLE IF NOT EXISTS bot_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) UNIQUE,
    system_prompt TEXT,
    warmth INTEGER DEFAULT 7,
    humor INTEGER DEFAULT 3,
    closing_aggressiveness INTEGER DEFAULT 5,
    use_emojis BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DOCUMENTS (V5)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='organization_id') THEN
        ALTER TABLE documents ADD COLUMN organization_id UUID REFERENCES organizations(id);
    END IF;
END $$;

-- 4. TRIGGERS FOR updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_modtime BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_bot_settings_modtime BEFORE UPDATE ON bot_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 5. INDEXES (Performance V5)
CREATE INDEX IF NOT EXISTS idx_contacts_org_v5 ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_org_v5 ON messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_v5 ON messages(channel);
CREATE INDEX IF NOT EXISTS idx_usage_org_v5 ON usage_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- 6. RLS POLICIES (Development: Allow All, Production: Filter by user claims)
-- ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Isolation by Org" ON messages FOR ALL USING (organization_id = auth.uid_org());

-- ============================================================
-- STORED PROCEDURES (V5 RPCs)
-- ============================================================

-- A. RESERVAR CRÉDITO (V5)
CREATE OR REPLACE FUNCTION reserve_credit_v5(target_org_id UUID, reserve_amount DECIMAL)
RETURNS JSONB AS $$
DECLARE
    current_balance DECIMAL;
BEGIN
    SELECT credit_balance INTO current_balance FROM organizations WHERE id = target_org_id FOR UPDATE;
    IF current_balance >= reserve_amount THEN
        UPDATE organizations SET credit_balance = credit_balance - reserve_amount WHERE id = target_org_id;
        RETURN jsonb_build_object('success', true, 'remaining', current_balance - reserve_amount);
    ELSE
        RETURN jsonb_build_object('success', false, 'reason', 'Crédito insuficiente');
    END IF;
END;
$$ LANGUAGE plpgsql;

-- B. AJUSTAR CRÉDITO (V5)
CREATE OR REPLACE FUNCTION adjust_credit_v5(target_org_id UUID, adjustment_amount DECIMAL)
RETURNS VOID AS $$
BEGIN
    UPDATE organizations SET credit_balance = credit_balance + adjustment_amount WHERE id = target_org_id;
END;
$$ LANGUAGE plpgsql;

-- C. UPDATE LEAD STAGE (V5)
CREATE OR REPLACE FUNCTION update_lead_stage_v5(target_id UUID, target_stage TEXT, target_org_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE contacts 
    SET lead_stage = target_stage 
    WHERE id = target_id AND organization_id = target_org_id;
END;
$$ LANGUAGE plpgsql;

-- SEED: DEMO ORG V5
INSERT INTO organizations (name, slug, credit_balance, status)
VALUES ('Alcance AI V5 Demo', 'v5-demo', 100.00, 'active')
ON CONFLICT (slug) DO NOTHING;

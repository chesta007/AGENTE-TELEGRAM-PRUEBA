-- ============================================================
-- ALCANCE AI - ARCHITECTURE V4 (UNIFIED INBOX & MULTI-TENANT)
-- ============================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ORGANIZATIONS TABLE (UUID-based for V4)
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

-- 3. UPDATING CONTACTS TABLE
DO $$ 
BEGIN
    -- organization_id UUID
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='organization_id') THEN
        ALTER TABLE contacts ADD COLUMN organization_id UUID REFERENCES organizations(id);
    END IF;
    
    -- lead_stage
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='lead_stage') THEN
        ALTER TABLE contacts ADD COLUMN lead_stage TEXT DEFAULT 'new'; 
    END IF;

    -- external_id (Telegram ID, WhatsApp Number, etc.)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='external_id') THEN
        ALTER TABLE contacts ADD COLUMN external_id TEXT;
    END IF;
END $$;

-- 4. MESSAGES TABLE (UNIFIED V4)
DROP TABLE IF EXISTS messages CASCADE;
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    contact_id UUID REFERENCES contacts(id),
    content TEXT NOT NULL,
    sender TEXT NOT NULL, -- 'user', 'agent', 'system'
    channel TEXT NOT NULL, -- 'telegram', 'whatsapp', 'messenger', 'instagram'
    external_id TEXT, -- ID del mensaje en la plataforma origen
    tokens INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. USAGE LOGS (V4)
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    tokens_used INTEGER NOT NULL,
    cost_usd DECIMAL(12, 8) NOT NULL,
    model_used TEXT NOT NULL,
    message_id UUID REFERENCES messages(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. BOT SETTINGS (V4)
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

-- 7. DOCUMENTS (V4)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='organization_id') THEN
        ALTER TABLE documents ADD COLUMN organization_id UUID REFERENCES organizations(id);
    END IF;
END $$;

-- 8. INDEXES (Performance V4)
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel);
CREATE INDEX IF NOT EXISTS idx_bot_settings_org ON bot_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_docs_org ON documents(organization_id);

-- 9. RLS POLICIES (Development Mode: Allow All, comment for production)
-- ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- EXAMPLE POLICY (Commented)
-- CREATE POLICY "Isolation by Organization" ON messages
-- FOR ALL USING (organization_id = auth.uid_org_id());

-- ============================================================
-- STORED PROCEDURES (V4 RPCs)
-- ============================================================

-- A. RESERVAR CRÉDITO (UUID V4)
CREATE OR REPLACE FUNCTION reserve_credit_atomic_v4(target_org_id UUID, reserve_amount DECIMAL)
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

-- B. AJUSTAR CRÉDITO (UUID V4)
CREATE OR REPLACE FUNCTION adjust_credit_v4(target_org_id UUID, adjustment_amount DECIMAL)
RETURNS VOID AS $$
BEGIN
    UPDATE organizations SET credit_balance = credit_balance + adjustment_amount WHERE id = target_org_id;
END;
$$ LANGUAGE plpgsql;

-- C. UPDATE LEAD STAGE (Lead Stage V4)
CREATE OR REPLACE FUNCTION update_lead_stage_v4(target_id UUID, target_stage TEXT, target_org_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE contacts 
    SET lead_stage = target_stage 
    WHERE id = target_id AND organization_id = target_org_id;
END;
$$ LANGUAGE plpgsql;

-- 10. SEED (Optional Demo Org)
INSERT INTO organizations (name, slug, credit_balance)
VALUES ('Alcance AI V4 Demo', 'demo-v4', 50.00)
ON CONFLICT (slug) DO NOTHING;

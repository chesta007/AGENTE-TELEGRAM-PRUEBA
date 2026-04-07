-- ================================================
-- ALCANCE AI V6.3 - FINAL SAFE MIGRATION
-- ================================================

-- 1. Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMs
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_status') THEN
        CREATE TYPE organization_status AS ENUM ('active', 'paused', 'suspended');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_channel') THEN
        CREATE TYPE message_channel AS ENUM ('telegram', 'whatsapp', 'messenger', 'instagram');
    END IF;
END $$;

-- 3. Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    credit_balance DECIMAL(12, 4) DEFAULT 50.00,
    status organization_status DEFAULT 'active',
    monthly_fee_status TEXT DEFAULT 'trial',
    whatsapp_instance_id TEXT UNIQUE,
    preferred_llm TEXT DEFAULT 'meta-llama/llama-3.1-8b-instruct',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Core Tables
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    city TEXT,
    source TEXT,
    lead_stage TEXT DEFAULT 'new',
    notes TEXT,
    last_interaction TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(phone, organization_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    sender TEXT NOT NULL,
    channel message_channel NOT NULL,
    external_id TEXT,
    lead_stage TEXT,
    tokens INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    tokens_used INTEGER NOT NULL,
    cost_usd DECIMAL(12, 8) NOT NULL,
    model_used TEXT NOT NULL,
    channel message_channel,
    message_id UUID REFERENCES messages(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bot_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    warmth INTEGER DEFAULT 7,
    humor INTEGER DEFAULT 3,
    closing_aggressiveness INTEGER DEFAULT 5,
    use_emojis BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_org ON usage_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instance ON organizations(whatsapp_instance_id);

-- 6. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_orgs_updated_at 
    BEFORE UPDATE ON organizations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_bot_settings_updated_at 
    BEFORE UPDATE ON bot_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Seed Default Organization
INSERT INTO organizations (name, slug, credit_balance, status)
VALUES ('Alcance AI Default', 'default', 50.00, 'active')
ON CONFLICT (slug) DO NOTHING;

-- 8. RLS - Development Mode
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de desarrollo
DROP POLICY IF EXISTS "Dev Allow All" ON organizations;
DROP POLICY IF EXISTS "Dev Allow All" ON contacts;
DROP POLICY IF EXISTS "Dev Allow All" ON messages;
DROP POLICY IF EXISTS "Dev Allow All" ON documents;
DROP POLICY IF EXISTS "Dev Allow All" ON usage_logs;
DROP POLICY IF EXISTS "Dev Allow All" ON bot_settings;

CREATE POLICY "Dev Allow All" ON organizations FOR ALL USING (true);
CREATE POLICY "Dev Allow All" ON contacts FOR ALL USING (true);
CREATE POLICY "Dev Allow All" ON messages FOR ALL USING (true);
CREATE POLICY "Dev Allow All" ON documents FOR ALL USING (true);
CREATE POLICY "Dev Allow All" ON usage_logs FOR ALL USING (true);
CREATE POLICY "Dev Allow All" ON bot_settings FOR ALL USING (true);

SELECT '✅ Migración V6.3 ejecutada correctamente - Todas las tablas creadas y corregidas' AS resultado;
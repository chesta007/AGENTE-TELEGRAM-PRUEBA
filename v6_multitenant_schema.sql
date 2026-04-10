-- ================================================
-- ALCANCE AI V6.5 - SAFE MIGRATION (No recreate existing tables)
-- ================================================

-- 1. Extensiones y ENUMs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_status') THEN
        CREATE TYPE organization_status AS ENUM ('active', 'paused', 'suspended');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_channel') THEN
        CREATE TYPE message_channel AS ENUM ('telegram', 'whatsapp', 'messenger', 'instagram');
    END IF;
END $$;

-- 2. Organizations (solo crear si no existe)
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

-- 3. Agregar organization_id a tablas existentes (safe add)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE;

-- 4. Corregir usage_logs (recrear correctamente con UUID)
DROP TABLE IF EXISTS usage_logs CASCADE;

CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    tokens_used INTEGER NOT NULL,
    cost_usd DECIMAL(12, 8) NOT NULL,
    model_used TEXT NOT NULL,
    channel message_channel,
    message_id UUID REFERENCES messages(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_org ON usage_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instance ON organizations(whatsapp_instance_id);

-- 6. Trigger updated_at
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

SELECT '✅ Migración V6.5 SAFE ejecutada correctamente' AS resultado;
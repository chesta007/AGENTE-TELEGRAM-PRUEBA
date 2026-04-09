-- ============================================================
-- ALCANCE V6.7 - ESQUEMA MÍNIMO SEGURO (UUID COMPLETOS)
-- ============================================================
-- Nota: Ejecutar este script completo para resetear/corregir 
-- tipos de datos UUID e inconsistencias de foreign keys.

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMs (Manejo seguro)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_status') THEN
        CREATE TYPE organization_status AS ENUM ('active', 'paused', 'suspended');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_channel') THEN
        CREATE TYPE message_channel AS ENUM ('telegram', 'whatsapp', 'messenger', 'instagram');
    END IF;
END $$;

-- 3. ORGANIZATIONS
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    credit_balance DECIMAL(12, 4) DEFAULT 10.00,
    status organization_status DEFAULT 'active',
    whatsapp_instance_id TEXT UNIQUE,
    preferred_llm TEXT DEFAULT 'meta-llama/llama-3.1-8b-instruct',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CONTACTS
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    city TEXT,
    source TEXT,
    lead_stage TEXT DEFAULT 'new',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(phone, organization_id)
);

-- 5. MESSAGES
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    sender TEXT NOT NULL, -- 'user', 'agent'
    channel message_channel NOT NULL,
    external_id TEXT,
    lead_stage TEXT,
    tokens INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. BOT SETTINGS (With current_prompt)
CREATE TABLE IF NOT EXISTS bot_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    current_prompt TEXT,
    warmth INTEGER DEFAULT 7,
    humor INTEGER DEFAULT 3,
    closing_aggressiveness INTEGER DEFAULT 5,
    use_emojis BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. USAGE LOGS
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

-- 8. ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_org_id ON messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_org_id ON usage_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations(slug);

-- 9. RLS (Modo Desarrollo - ALLOW ALL)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow All Dev" ON organizations FOR ALL USING (true);
CREATE POLICY "Allow All Dev" ON contacts FOR ALL USING (true);
CREATE POLICY "Allow All Dev" ON messages FOR ALL USING (true);
CREATE POLICY "Allow All Dev" ON bot_settings FOR ALL USING (true);
CREATE POLICY "Allow All Dev" ON usage_logs FOR ALL USING (true);

-- 10. ORGANIZACIÓN DEFAULT
INSERT INTO organizations (name, slug, credit_balance, status)
VALUES ('Alcance AI Default', 'default', 10.00, 'active')
ON CONFLICT (slug) DO NOTHING;

-- MODO RE-RUN: Mensaje de confirmación
SELECT '✅ Esquema Alcance V6.7 (UUID) desplegado correctamente.' AS status;

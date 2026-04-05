CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  credit_balance DECIMAL(12,4) DEFAULT 0.00 NOT NULL,
  monthly_fee_status TEXT DEFAULT 'pending' CHECK (monthly_fee_status IN ('active', 'pending', 'overdue', 'canceled')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_organizations_slug ON organizations(slug);

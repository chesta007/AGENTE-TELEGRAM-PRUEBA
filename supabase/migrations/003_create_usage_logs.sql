CREATE TABLE usage_logs (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tokens_used INTEGER NOT NULL,
  cost_usd DECIMAL(10,6) NOT NULL,
  model_used TEXT,
  message_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_usage_org ON usage_logs(organization_id, created_at);

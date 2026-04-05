CREATE TABLE agent_tool_logs (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  arguments JSONB,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tool_logs_org ON agent_tool_logs(organization_id);
ALTER TABLE agent_tool_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read for Agent Tool Logs" ON agent_tool_logs FOR SELECT USING (true);

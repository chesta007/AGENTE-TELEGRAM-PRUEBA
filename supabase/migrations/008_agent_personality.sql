CREATE TABLE agent_personality (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  warmth INTEGER DEFAULT 7 CHECK (warmth BETWEEN 1 AND 10),
  closing_aggressiveness INTEGER DEFAULT 5 CHECK (closing_aggressiveness BETWEEN 1 AND 10),
  humor INTEGER DEFAULT 3 CHECK (humor BETWEEN 0 AND 10),
  response_length TEXT DEFAULT 'medium' CHECK (response_length IN ('short', 'medium', 'long')),
  use_emojis BOOLEAN DEFAULT true,
  sales_method TEXT DEFAULT 'direct' CHECK (sales_method IN ('consultative', 'direct', 'spin')),
  custom_instructions TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Políticas RLS
ALTER TABLE agent_personality ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read for Agent Personality" ON agent_personality FOR SELECT USING (true);
CREATE POLICY "Public Update for Agent Personality" ON agent_personality FOR UPDATE USING (true);
CREATE POLICY "Public Insert for Agent Personality" ON agent_personality FOR INSERT WITH CHECK (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_agent_personality_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_agent_personality_timestamp
BEFORE UPDATE ON agent_personality
FOR EACH ROW EXECUTE FUNCTION update_agent_personality_timestamp();

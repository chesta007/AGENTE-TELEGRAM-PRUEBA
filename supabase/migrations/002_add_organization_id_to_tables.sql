ALTER TABLE contacts ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_contacts_org ON contacts(organization_id);

ALTER TABLE messages ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_messages_org ON messages(organization_id);

ALTER TABLE documents ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_documents_org ON documents(organization_id);

ALTER TABLE agent_context ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_agent_context_org ON agent_context(organization_id);

ALTER TABLE bot_settings ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_bot_settings_org ON bot_settings(organization_id);

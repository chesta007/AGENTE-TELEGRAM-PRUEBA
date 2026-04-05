-- Habilitar RLS en todas las tablas
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso por organization_id (Simples por ahora ya que el Dashboard usa anon key)
-- NOTA: En un SaaS real, se usaría auth.uid() vinculado a organization_id.
-- Para esta fase de pruebas, permitiremos lectura si el organization_id coincide con el contexto (simulado en el dashboard con filtros).

CREATE POLICY "Public Read for Organizations" ON organizations FOR SELECT USING (true);
CREATE POLICY "Public Read for Contacts" ON contacts FOR SELECT USING (true);
CREATE POLICY "Public Read for Messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Public Read for Documents" ON documents FOR SELECT USING (true);
CREATE POLICY "Public Read for Agent Context" ON agent_context FOR SELECT USING (true);
CREATE POLICY "Public Read for Bot Settings" ON bot_settings FOR SELECT USING (true);
CREATE POLICY "Public Read for Usage Logs" ON usage_logs FOR SELECT USING (true);

-- Nota: Para escritura, solemos restringirlo más, pero por ahora se mantiene abierto para facilitar la integración.

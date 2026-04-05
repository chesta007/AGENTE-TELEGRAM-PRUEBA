INSERT INTO organizations (name, slug, credit_balance, status)
VALUES ('Default Org', 'default', 100.00, 'active')
ON CONFLICT (slug) DO NOTHING;

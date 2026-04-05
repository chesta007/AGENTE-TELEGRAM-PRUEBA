-- RPC para decrementar el balance de forma atómica
CREATE OR REPLACE FUNCTION decrement_balance(org_id UUID, amount DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE organizations
  SET credit_balance = credit_balance - amount
  WHERE id = org_id;
END;
$$ LANGUAGE plpgsql;

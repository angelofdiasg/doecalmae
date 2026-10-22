CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL UNIQUE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  frequency TEXT NOT NULL CHECK (frequency IN ('once', 'monthly')),
  billing_type TEXT NOT NULL CHECK (billing_type IN ('PIX', 'BOLETO', 'CREDIT_CARD')),
  status TEXT NOT NULL DEFAULT 'CREATING',
  asaas_customer_id TEXT,
  asaas_payment_id TEXT,
  asaas_subscription_id TEXT,
  checkout_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS donations_payment_id_idx
  ON donations (asaas_payment_id);

CREATE INDEX IF NOT EXISTS donations_subscription_id_idx
  ON donations (asaas_subscription_id);

CREATE TABLE IF NOT EXISTS asaas_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

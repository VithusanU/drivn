-- Store encrypted Anthropic API keys for BYOK (bring-your-own-key) users
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS anthropic_key_encrypted TEXT;

-- Masked version safe to return to the client (e.g. "sk-ant-...wQAA")
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS anthropic_key_masked TEXT;

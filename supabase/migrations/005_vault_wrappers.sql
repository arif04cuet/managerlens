-- Public wrappers around vault schema functions so app code can call them via RPC
CREATE OR REPLACE FUNCTION public.vault_create_secret(secret text, name text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, public
AS $$
  SELECT vault.create_secret(secret, name);
$$;

CREATE OR REPLACE FUNCTION public.vault_update_secret(secret_id uuid, new_secret text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, public
AS $$
  SELECT vault.update_secret(secret_id, new_secret);
$$;

CREATE OR REPLACE FUNCTION public.vault_decrypted_secret(secret_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, public
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = secret_id;
$$;

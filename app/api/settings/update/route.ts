import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) {
    return NextResponse.json({ error: "No tenant found" }, { status: 400 });
  }

  const { tracking_email, app_password, allowed_domains, banned_words, stalled_threshold_days } =
    await request.json();

  const service = createServiceClient();

  // If a new credential was provided, store it in Vault and update the reference
  let secret_id: string | undefined;
  if (app_password) {
    // Upsert the secret — if one already exists, replace it
    const { data: existingTenant } = await service
      .from("tenants")
      .select("email_credentials_secret_id")
      .eq("id", userData.tenant_id)
      .single();

    if (existingTenant?.email_credentials_secret_id) {
      // Update existing vault secret
      const { error } = await service.rpc("vault_update_secret", {
        secret_id: existingTenant.email_credentials_secret_id,
        new_secret: app_password,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      secret_id = existingTenant.email_credentials_secret_id;
    } else {
      // Create new vault secret
      const { data, error } = await service.rpc("vault_create_secret", {
        secret: app_password,
        name: `tenant_${userData.tenant_id}_email_creds`,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      secret_id = data;
    }
  }

  const update: Record<string, unknown> = {
    tracking_email,
    allowed_domains,
    banned_words,
    stalled_threshold_days,
  };
  if (secret_id) update.email_credentials_secret_id = secret_id;

  const { error } = await service
    .from("tenants")
    .update(update)
    .eq("id", userData.tenant_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

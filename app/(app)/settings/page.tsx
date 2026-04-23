import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Your account is not linked to a workspace. Contact your administrator.
      </div>
    );
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, tracking_email, allowed_domains, banned_words, stalled_threshold_days")
    .eq("id", userData.tenant_id)
    .single();

  if (!tenant) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Workspace not found. Contact your administrator.
      </div>
    );
  }

  return <SettingsClient tenant={tenant} />;
}

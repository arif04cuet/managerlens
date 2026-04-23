import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import AdminClient from "./admin-client";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, manager_email, tracking_email, stalled_threshold_days, created_at")
    .order("created_at", { ascending: false });

  return <AdminClient tenants={tenants ?? []} />;
}

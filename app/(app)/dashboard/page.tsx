import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ThreadList from "./thread-list";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (userData?.role === "super_admin") redirect("/admin");
  if (!userData?.tenant_id) redirect("/settings");

  const { data: threads } = await supabase
    .from("threads")
    .select("*")
    .eq("tenant_id", userData.tenant_id)
    .neq("status", "dismissed")
    .order("last_email_date", { ascending: false });

  return <ThreadList initialThreads={threads ?? []} tenantId={userData.tenant_id} />;
}

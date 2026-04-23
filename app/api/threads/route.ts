import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) return NextResponse.json({ threads: [] });

  const { data: threads } = await supabase
    .from("threads")
    .select("*")
    .eq("tenant_id", userData.tenant_id)
    .neq("status", "dismissed")
    .order("last_email_date", { ascending: false });

  return NextResponse.json({ threads: threads ?? [] });
}

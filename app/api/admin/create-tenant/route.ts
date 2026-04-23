import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Verify caller is a super_admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (caller?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, manager_email } = await request.json();
  if (!name || !manager_email) {
    return NextResponse.json({ error: "name and manager_email are required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Create tenant row
  const { data: tenant, error: tenantError } = await service
    .from("tenants")
    .insert({ name, manager_email })
    .select("id")
    .single();

  if (tenantError) {
    return NextResponse.json({ error: tenantError.message }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const { error: inviteError } = await service.auth.admin.inviteUserByEmail(manager_email, {
    data: { tenant_id: tenant.id, role: "manager" },
    redirectTo: `${origin}/signup`,
  });

  if (inviteError) {
    // Roll back tenant row to keep state consistent
    await service.from("tenants").delete().eq("id", tenant.id);
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, tenant_id: tenant.id });
}

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("threads")
    .update({ status: "resolved" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Use service client to bypass RLS for system message insert
  const service = createServiceClient();
  await service.from("messages").insert({
    thread_id: id,
    message_id: `system:resolved:${Date.now()}`,
    sender: "__system__",
    body_snippet: `Marked as resolved by ${user.email}`,
    received_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}

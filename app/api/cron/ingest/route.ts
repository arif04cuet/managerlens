import { createServiceClient } from "@/lib/supabase/service";
import { fetchNewEmails } from "@/lib/email";
import { NextResponse } from "next/server";

export const maxDuration = 300; // 5 min Vercel function timeout

export async function GET(request: Request) {
  // Authenticate cron call
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  // Fetch all active tenants that have a tracking email configured
  const { data: tenants, error: tenantError } = await service
    .from("tenants")
    .select("id, tracking_email, email_credentials_secret_id, allowed_domains, banned_words, stalled_threshold_days, last_ingested_at")
    .not("tracking_email", "is", null)
    .not("email_credentials_secret_id", "is", null);

  if (tenantError) {
    console.error("Failed to fetch tenants:", tenantError);
    return NextResponse.json({ error: "Failed to fetch tenants" }, { status: 500 });
  }

  const results = [];

  for (const tenant of tenants ?? []) {
    try {
      // Decrypt credentials from Vault
      const { data: secretData, error: vaultError } = await service.rpc("vault_decrypted_secret", {
        secret_id: tenant.email_credentials_secret_id,
      });

      if (vaultError || !secretData) {
        console.error(`Vault decrypt failed for tenant ${tenant.id}:`, vaultError);
        continue;
      }

      const appPassword = secretData as string;
      // Use last_ingested_at as the fetch window; fall back to 1 day on first run
      const sinceDate = tenant.last_ingested_at
        ? new Date(tenant.last_ingested_at)
        : new Date(Date.now() - 86_400_000);
      const ingestStartedAt = new Date();
      const emails = await fetchNewEmails(tenant.tracking_email!, appPassword, sinceDate);

      let processed = 0;

      for (const email of emails) {
        // Dedup: skip if message_id already exists
        const { count } = await service
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("message_id", email.messageId);

        if (count && count > 0) continue;

        // Filter: allowed domains
        const senderDomain = email.from.match(/@([\w.-]+)/)?.[1]?.toLowerCase();
        if (
          tenant.allowed_domains.length > 0 &&
          senderDomain &&
          !tenant.allowed_domains.some((d: string) => senderDomain.endsWith(d.toLowerCase()))
        ) {
          continue;
        }

        // Filter: banned words (subject + body)
        const content = `${email.subject} ${email.body}`.toLowerCase();
        if (tenant.banned_words.some((w: string) => content.includes(w.toLowerCase()))) {
          continue;
        }

        // Upsert thread by subject (simple grouping — same subject = same thread)
        const normalizedSubject = email.subject.replace(/^(re|fwd?):\s*/i, "").trim();

        let { data: thread } = await service
          .from("threads")
          .select("id, status")
          .eq("tenant_id", tenant.id)
          .ilike("subject", normalizedSubject)
          .maybeSingle();

        if (!thread) {
          const { data: newThread } = await service
            .from("threads")
            .insert({
              tenant_id: tenant.id,
              subject: normalizedSubject,
              original_sender: email.from,
              recipients: email.to,
              status: "active",
              last_email_date: email.date.toISOString(),
            })
            .select("id, status")
            .single();
          thread = newThread;
        } else {
          // Update last_email_date and reset status to active if it was stalled
          const update: Record<string, unknown> = { last_email_date: email.date.toISOString() };
          if (thread.status === "stalled") update.status = "active";
          await service.from("threads").update(update).eq("id", thread.id);
        }

        if (!thread) continue;

        // Insert message
        await service.from("messages").insert({
          thread_id: thread.id,
          message_id: email.messageId,
          sender: email.from,
          body_snippet: email.body.slice(0, 500),
          received_at: email.date.toISOString(),
        });

        // Update waiting_on to the latest To: recipient
        if (email.to) {
          await service.from("threads").update({ waiting_on: email.to }).eq("id", thread.id);
        }

        processed++;
      }

      // Mark stalled threads for this tenant
      const stalledCutoff = new Date(
        Date.now() - tenant.stalled_threshold_days * 86_400_000
      ).toISOString();

      await service
        .from("threads")
        .update({ status: "stalled" })
        .eq("tenant_id", tenant.id)
        .eq("status", "active")
        .lt("last_email_date", stalledCutoff);

      await service
        .from("tenants")
        .update({ last_ingested_at: ingestStartedAt.toISOString() })
        .eq("id", tenant.id);

      results.push({ tenant_id: tenant.id, processed });
    } catch (err) {
      console.error(`Error processing tenant ${tenant.id}:`, err);
      results.push({ tenant_id: tenant.id, error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, results });
}

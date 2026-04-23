import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ResolveButton from "./resolve-button";

const STATUS_CONFIG = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  stalled: { label: "Stalled", className: "bg-amber-100 text-amber-700 border-amber-200" },
  resolved: { label: "Resolved", className: "bg-slate-100 text-slate-600 border-slate-200" },
  dismissed: { label: "Dismissed", className: "bg-red-100 text-red-600 border-red-200" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

const DOT_COLORS = [
  { dot: "bg-violet-500", ring: "ring-violet-200", label: "bg-violet-50 text-violet-700 border-violet-200" },
  { dot: "bg-blue-500",   ring: "ring-blue-200",   label: "bg-blue-50 text-blue-700 border-blue-200" },
  { dot: "bg-emerald-500",ring: "ring-emerald-200", label: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { dot: "bg-amber-500",  ring: "ring-amber-200",  label: "bg-amber-50 text-amber-700 border-amber-200" },
  { dot: "bg-rose-500",   ring: "ring-rose-200",   label: "bg-rose-50 text-rose-700 border-rose-200" },
];

function senderColor(email: string) {
  const hash = [...email].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return DOT_COLORS[hash % DOT_COLORS.length];
}

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/settings");

  const { data: thread } = await supabase
    .from("threads")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (!thread) notFound();

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender, body_snippet, received_at")
    .eq("thread_id", id)
    .order("received_at", { ascending: false });

  const cfg = STATUS_CONFIG[thread.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.active;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2 text-slate-600">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div className="h-5 w-px bg-slate-200" />
          <p className="text-sm text-slate-500">Thread detail</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Thread meta */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-xl font-semibold text-slate-900 leading-snug">{thread.subject}</h1>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.className}`}>
                {cfg.label}
              </span>
              {thread.status !== "resolved" && thread.status !== "dismissed" && (
                <ResolveButton threadId={thread.id} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">From</p>
              <p className="text-slate-700 mt-0.5">{thread.original_sender}</p>
            </div>
            {thread.recipients && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">To</p>
                <p className="text-slate-700 mt-0.5">{thread.recipients}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Initiated</p>
              <p className="text-slate-700 mt-0.5">{formatDateTime(thread.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Last updated</p>
              <p className="text-slate-700 mt-0.5">{formatDateTime(thread.last_email_date)}</p>
            </div>
          </div>

          {(thread.ai_summary || thread.waiting_on) && (
            <div className="border-t border-slate-100 pt-4 space-y-3">
              {thread.ai_summary && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">AI Summary</p>
                  <p className="text-sm text-slate-700 mt-1">{thread.ai_summary}</p>
                </div>
              )}
              {thread.waiting_on && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Waiting on</p>
                  <p className="text-sm text-slate-700 mt-1">{thread.waiting_on}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-6">
            Timeline · {messages?.length ?? 0} {messages?.length === 1 ? "message" : "messages"}
          </h2>

          {!messages || messages.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400 text-sm">
              No messages recorded yet
            </div>
          ) : (
            <div className="space-y-0">
              {messages.map((msg, i) => {
                const isSystem = msg.sender === "__system__";
                const isFirst = i === 0;
                const isLast = i === messages.length - 1;
                const color = isSystem ? null : senderColor(msg.sender);

                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex gap-0">
                      {/* Left: date */}
                      <div className="w-52 shrink-0 pr-6 pt-1 text-right">
                        <p className="text-xs font-semibold text-slate-700">{formatDate(msg.received_at)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatTime(msg.received_at)}</p>
                      </div>

                      {/* Centre: line + diamond */}
                      <div className="flex flex-col items-center w-10 shrink-0">
                        <div className={`w-px flex-1 ${isFirst ? "bg-transparent" : "bg-slate-200"}`} style={{ minHeight: "16px" }} />
                        <div className="w-3 h-3 rounded-sm rotate-45 bg-emerald-500 ring-4 ring-emerald-100 z-10 shrink-0" />
                        <div className={`w-px flex-1 ${isLast ? "bg-transparent" : "bg-slate-200"}`} style={{ minHeight: "16px" }} />
                      </div>

                      {/* Right: event pill */}
                      <div className="flex-1 pl-4 pb-8 flex items-start pt-0.5">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          {msg.body_snippet}
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="flex gap-0">
                    {/* Left: date + sender */}
                    <div className="w-52 shrink-0 pr-6 pt-1 text-right">
                      <p className="text-xs font-semibold text-slate-700">{formatDate(msg.received_at)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatTime(msg.received_at)}</p>
                      <p className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full border font-medium truncate max-w-[11rem] ${color!.label}`}>
                        {msg.sender.split("@")[0]}
                      </p>
                    </div>

                    {/* Centre: line + dot */}
                    <div className="flex flex-col items-center w-10 shrink-0">
                      <div className={`w-px flex-1 ${isFirst ? "bg-transparent" : "bg-slate-200"}`} style={{ minHeight: "16px" }} />
                      <div className={`w-3 h-3 rounded-full shrink-0 ring-4 ${color!.dot} ${color!.ring} z-10`} />
                      <div className={`w-px flex-1 ${isLast ? "bg-transparent" : "bg-slate-200"}`} style={{ minHeight: "16px" }} />
                    </div>

                    {/* Right: message card */}
                    <div className="flex-1 pl-4 pb-8 pt-0">
                      <div className={`bg-white rounded-xl border p-4 shadow-sm ${isFirst ? "border-slate-300 shadow-slate-100" : "border-slate-200"}`}>
                        <p className="text-xs text-slate-400 mb-2 truncate" title={msg.sender}>{msg.sender}</p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {msg.body_snippet ?? "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Settings, X, ChevronRight, CheckCheck, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Thread = {
  id: string;
  subject: string;
  original_sender: string;
  recipients: string | null;
  status: "active" | "stalled" | "resolved" | "dismissed";
  waiting_on: string | null;
  ai_summary: string | null;
  last_email_date: string;
  created_at: string;
  tenant_id: string;
};

type Filter = "all" | "active" | "stalled" | "resolved";

const STATUS_CONFIG = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  stalled: { label: "Stalled", className: "bg-amber-100 text-amber-700 border-amber-200" },
  resolved: { label: "Resolved", className: "bg-slate-100 text-slate-600 border-slate-200" },
  dismissed: { label: "Dismissed", className: "bg-red-100 text-red-600 border-red-200" },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function shortEmail(email: string) {
  return email.length > 28 ? email.slice(0, 28) + "…" : email;
}

export default function ThreadList({
  initialThreads,
  tenantId,
}: {
  initialThreads: Thread[];
  tenantId: string;
}) {
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [filter, setFilter] = useState<Filter>("all");
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const router = useRouter();

  // Poll every 15 seconds as reliable fallback
  useEffect(() => {
    const poll = async () => {
      const res = await fetch("/api/threads");
      if (!res.ok) return;
      const { threads: fresh } = await res.json();
      setThreads(fresh);
    };
    const interval = setInterval(poll, 15_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("threads:all")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "threads" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const t = payload.new as Thread;
            if (t.tenant_id !== tenantId || t.status === "dismissed") return;
            setThreads((prev) => [t, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const t = payload.new as Thread;
            if (t.tenant_id !== tenantId) return;
            if (t.status === "dismissed") {
              setThreads((prev) => prev.filter((x) => x.id !== t.id));
            } else {
              setThreads((prev) => prev.map((x) => (x.id === t.id ? t : x)));
            }
          } else if (payload.eventType === "DELETE") {
            setThreads((prev) => prev.filter((x) => x.id !== payload.old.id));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  async function dismiss(id: string) {
    setDismissing(id);
    await fetch(`/api/threads/${id}/dismiss`, { method: "PATCH" });
    setThreads((prev) => prev.filter((t) => t.id !== id));
    setDismissing(null);
  }

  async function resolve(id: string) {
    setResolving(id);
    await fetch(`/api/threads/${id}/resolve`, { method: "PATCH" });
    setThreads((prev) => prev.map((t) => t.id === id ? { ...t, status: "resolved" } : t));
    setResolving(null);
  }

  const counts = {
    all: threads.length,
    active: threads.filter((t) => t.status === "active").length,
    stalled: threads.filter((t) => t.status === "stalled").length,
    resolved: threads.filter((t) => t.status === "resolved").length,
  };

  const visible = filter === "all" ? threads : threads.filter((t) => t.status === filter);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "stalled", label: "Stalled" },
    { key: "resolved", label: "Resolved" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">ManagerLens</h1>
            <p className="text-sm text-slate-500">Email thread tracking</p>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="text-slate-600 gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </Button>
            </Link>
            <Button variant="ghost" size="sm" className="text-slate-600 gap-2" onClick={async () => {
              await createClient().auth.signOut();
              router.push("/login");
            }}>
              <LogOut className="w-4 h-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {(["active", "stalled", "resolved"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`bg-white rounded-xl border p-4 text-left transition-all hover:shadow-sm ${
                filter === s ? "ring-2 ring-slate-400 border-slate-400" : "border-slate-200"
              }`}
            >
              <p className="text-2xl font-bold text-slate-900">{counts[s]}</p>
              <p className="text-sm text-slate-500 capitalize mt-0.5">{s}</p>
            </button>
          ))}
        </div>

        {/* Filter tabs + table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 pt-4 border-b border-slate-100">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-2 text-sm font-medium rounded-t-md transition-colors relative ${
                  filter === key
                    ? "text-slate-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  filter === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {counts[key]}
                </span>
              </button>
            ))}
          </div>

          {/* Table */}
          {visible.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              No {filter === "all" ? "" : filter} threads
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-[30%]">Subject</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">From</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">To</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Initiated</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Updated</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((thread) => {
                  const cfg = STATUS_CONFIG[thread.status];
                  return (
                    <TableRow
                      key={thread.id}
                      className="hover:bg-slate-50/60 group cursor-pointer"
                      onClick={() => router.push(`/dashboard/${thread.id}`)}
                    >
                      <TableCell className="font-medium text-slate-800 text-sm max-w-[260px]">
                        <div className="truncate" title={thread.subject}>{thread.subject}</div>
                        {thread.ai_summary && (
                          <div className="text-xs text-slate-400 truncate mt-0.5" title={thread.ai_summary}>
                            {thread.ai_summary}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 max-w-[180px]">
                        <div className="truncate" title={thread.original_sender}>
                          {shortEmail(thread.original_sender)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 max-w-[180px]">
                        <div className="truncate" title={thread.recipients ?? ""}>
                          {thread.recipients ? shortEmail(thread.recipients) : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                        {formatDate(thread.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                        {formatDate(thread.last_email_date)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
                          {cfg.label}
                        </span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {thread.status !== "resolved" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                              disabled={resolving === thread.id}
                              onClick={() => resolve(thread.id)}
                              title="Mark as resolved"
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 hover:bg-red-50"
                            disabled={dismissing === thread.id}
                            onClick={() => dismiss(thread.id)}
                            title="Dismiss"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                          <ChevronRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    </div>
  );
}

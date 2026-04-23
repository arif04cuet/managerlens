"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Thread = {
  id: string;
  subject: string;
  original_sender: string;
  recipients: string | null;
  status: "active" | "stalled" | "resolved" | "dismissed";
  waiting_on: string | null;
  ai_summary: string | null;
  last_email_date: string;
  tenant_id: string;
};

const COLUMNS: { key: Thread["status"]; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "stalled", label: "Stalled" },
  { key: "resolved", label: "Resolved" },
];

export default function KanbanBoard({
  initialThreads,
  tenantId,
}: {
  initialThreads: Thread[];
  tenantId: string;
}) {
  const [threads, setThreads] = useState<Thread[]>(initialThreads);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`threads:tenant=${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "threads",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setThreads((prev) => [payload.new as Thread, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setThreads((prev) =>
              prev.map((t) => (t.id === payload.new.id ? (payload.new as Thread) : t))
            );
          } else if (payload.eventType === "DELETE") {
            setThreads((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {COLUMNS.map((col) => {
        const colThreads = threads.filter((t) => t.status === col.key);
        return (
          <div key={col.key} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{col.label}</h2>
              <Badge variant="secondary">{colThreads.length}</Badge>
            </div>
            {colThreads.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                No {col.label.toLowerCase()} items
              </p>
            ) : (
              colThreads.map((thread) => (
                <ThreadCard key={thread.id} thread={thread} />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

function ThreadCard({ thread }: { thread: Thread }) {
  const daysSince = Math.floor(
    (Date.now() - new Date(thread.last_email_date).getTime()) / 86_400_000
  );

  return (
    <Card className={thread.status === "stalled" ? "border-red-300" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium leading-snug line-clamp-2">
          {thread.subject}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground/60">From:</span> {thread.original_sender}
        </p>
        {thread.recipients && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/60">To:</span> {thread.recipients}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {thread.ai_summary && (
          <p className="text-xs text-foreground/80">{thread.ai_summary}</p>
        )}
        {thread.waiting_on && (
          <p className="text-xs">
            <span className="font-medium">Waiting on:</span> {thread.waiting_on}
          </p>
        )}
        <div className="flex items-center justify-between pt-1">
          {thread.status === "stalled" && (
            <Badge variant="destructive" className="text-xs">Stalled</Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {daysSince === 0 ? "Today" : `${daysSince}d ago`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

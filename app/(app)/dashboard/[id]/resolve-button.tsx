"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCheck } from "lucide-react";

export default function ResolveButton({ threadId }: { threadId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function resolve() {
    setLoading(true);
    await fetch(`/api/threads/${threadId}/resolve`, { method: "PATCH" });
    router.refresh();
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300"
      disabled={loading}
      onClick={resolve}
    >
      <CheckCheck className="w-3.5 h-3.5" />
      Mark resolved
    </Button>
  );
}

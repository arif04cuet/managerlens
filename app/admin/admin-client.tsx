"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UserPlus, Building2, CheckCircle, AlertCircle, Mail, Settings } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Tenant = {
  id: string;
  name: string;
  manager_email: string;
  tracking_email: string | null;
  stalled_threshold_days: number;
  created_at: string;
};

export default function AdminClient({ tenants: initial }: { tenants: Tenant[] }) {
  const [tenants, setTenants] = useState<Tenant[]>(initial);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/create-tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, manager_email: email }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage({ type: "error", text: data.error ?? "Failed to create tenant" });
    } else {
      setMessage({ type: "success", text: `Invite sent to ${email}` });
      setName("");
      setEmail("");
      // Optimistically add to list
      setTenants((prev) => [{
        id: data.tenant_id ?? crypto.randomUUID(),
        name,
        manager_email: email,
        tracking_email: null,
        stalled_threshold_days: 3,
        created_at: new Date().toISOString(),
      }, ...prev]);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl font-semibold text-slate-900">ManagerLens</h1>
          <p className="text-sm text-slate-500">Super Admin</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Invite new manager */}
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Provision New Manager</p>
              <p className="text-xs text-slate-400">Creates a workspace and sends an invite email</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="px-6 py-5">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium text-slate-700">Organisation name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Corp"
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">Manager email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@acme.com"
                  required
                  className="h-10"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button type="submit" disabled={loading} className="h-10 px-5 gap-2">
                <UserPlus className="w-4 h-4" />
                {loading ? "Sending…" : "Create & Send Invite"}
              </Button>
              {message && (
                <div className={`flex items-center gap-2 text-sm ${message.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
                  {message.type === "success"
                    ? <CheckCircle className="w-4 h-4" />
                    : <AlertCircle className="w-4 h-4" />
                  }
                  {message.text}
                </div>
              )}
            </div>
          </form>
        </section>

        {/* Tenant list */}
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Tenants</p>
              <p className="text-xs text-slate-400">{tenants.length} workspace{tenants.length !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {tenants.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">No tenants yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Organisation</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Manager</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tracking Email</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stale After</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => (
                  <TableRow key={t.id} className="hover:bg-slate-50/60">
                    <TableCell className="font-medium text-slate-800">{t.name}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm text-slate-600">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {t.manager_email}
                      </span>
                    </TableCell>
                    <TableCell>
                      {t.tracking_email ? (
                        <span className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Settings className="w-3.5 h-3.5 text-slate-400" />
                          {t.tracking_email}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
                          Not configured
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{t.stalled_threshold_days}d</TableCell>
                    <TableCell className="text-sm text-slate-400">
                      {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

      </main>
    </div>
  );
}

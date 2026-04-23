"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Mail, Filter, Clock, CheckCircle, AlertCircle } from "lucide-react";

type Tenant = {
  id: string;
  name: string;
  tracking_email: string | null;
  allowed_domains: string[];
  banned_words: string[];
  stalled_threshold_days: number;
};

export default function SettingsClient({ tenant }: { tenant: Tenant }) {
  const [trackingEmail, setTrackingEmail] = useState(tenant.tracking_email ?? "");
  const [appPassword, setAppPassword] = useState("");
  const [allowedDomains, setAllowedDomains] = useState(tenant.allowed_domains.join(", "));
  const [bannedWords, setBannedWords] = useState(tenant.banned_words.join(", "));
  const [stalledDays, setStalledDays] = useState(String(tenant.stalled_threshold_days));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/settings/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tracking_email: trackingEmail,
        app_password: appPassword || undefined,
        allowed_domains: allowedDomains.split(",").map((s) => s.trim()).filter(Boolean),
        banned_words: bannedWords.split(",").map((s) => s.trim()).filter(Boolean),
        stalled_threshold_days: parseInt(stalledDays, 10),
      }),
    });
    const data = await res.json();
    setMessage(res.ok
      ? { type: "success", text: "Settings saved successfully." }
      : { type: "error", text: data.error ?? "Failed to save settings." }
    );
    if (res.ok && appPassword) setAppPassword("");
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2 text-slate-600">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div className="h-5 w-px bg-slate-200" />
          <div>
            <p className="text-sm font-semibold text-slate-900">{tenant.name}</p>
            <p className="text-xs text-slate-400">Settings</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={handleSave} className="space-y-4">

          {/* Tracking Email */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Mail className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Tracking Email</p>
                <p className="text-xs text-slate-400">The inbox employees CC to track requests</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tracking-email" className="text-sm font-medium text-slate-700">Email Address</Label>
                <Input
                  id="tracking-email"
                  type="email"
                  value={trackingEmail}
                  onChange={(e) => setTrackingEmail(e.target.value)}
                  placeholder="track.me@gmail.com"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="app-password" className="text-sm font-medium text-slate-700">
                  App Password
                  <span className="ml-2 text-xs text-slate-400 font-normal">leave blank to keep existing</span>
                </Label>
                <Input
                  id="app-password"
                  type="password"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  autoComplete="new-password"
                  className="h-10"
                />
                <p className="text-xs text-slate-400">Stored encrypted in Supabase Vault — never exposed in plain text.</p>
              </div>
            </div>
          </section>

          {/* Email Filters */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <Filter className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Email Filters</p>
                <p className="text-xs text-slate-400">Control which emails get tracked</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="allowed-domains" className="text-sm font-medium text-slate-700">Allowed Domains</Label>
                <Textarea
                  id="allowed-domains"
                  value={allowedDomains}
                  onChange={(e) => setAllowedDomains(e.target.value)}
                  placeholder="company.com, partner.com"
                  rows={2}
                  className="resize-none"
                />
                <p className="text-xs text-slate-400">Comma-separated. Leave empty to allow all domains.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="banned-words" className="text-sm font-medium text-slate-700">Banned Words</Label>
                <Textarea
                  id="banned-words"
                  value={bannedWords}
                  onChange={(e) => setBannedWords(e.target.value)}
                  placeholder="newsletter, unsubscribe, noreply"
                  rows={2}
                  className="resize-none"
                />
                <p className="text-xs text-slate-400">Comma-separated. Matched against subject and body.</p>
              </div>
            </div>
          </section>

          {/* Stalled Detection */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Stalled Detection</p>
                <p className="text-xs text-slate-400">Mark threads as stalled after inactivity</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={stalledDays}
                  onChange={(e) => setStalledDays(e.target.value)}
                  className="h-10 w-24"
                />
                <span className="text-sm text-slate-500">days without a reply → marked Stalled</span>
              </div>
            </div>
          </section>

          {/* Save */}
          <div className="flex items-center gap-4 pt-2">
            <Button type="submit" disabled={loading} className="h-10 px-6">
              {loading ? "Saving…" : "Save settings"}
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
      </main>
    </div>
  );
}

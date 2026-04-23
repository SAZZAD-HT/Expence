"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Shield, Users, Activity } from "lucide-react";

async function getToken(): Promise<string | null> {
  const s = createBrowserClient();
  const { data } = await s.auth.getSession();
  return data.session?.access_token ?? null;
}

interface HealthData {
  total_expenses: number;
  total_loans: number;
  total_credit_cards: number;
  last_activity: string | null;
  admin_email: string;
}

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"health" | "users">("health");

  useEffect(() => {
    async function load() {
      const token = await getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      const h = { Authorization: `Bearer ${token}` };
      const healthRes = await fetch("/api/admin?action=health", { headers: h });

      if (healthRes.status === 403) {
        setError("Access denied — admin only");
        setLoading(false);
        return;
      }

      if (healthRes.ok) {
        setHealth(await healthRes.json());
      }

      const usersRes = await fetch("/api/admin?action=users", { headers: h });
      if (usersRes.ok) {
        setUsers(await usersRes.json());
      }

      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 max-w-md text-center space-y-4">
          <Shield className="h-10 w-10 text-slate-400 mx-auto" />
          <p className="text-slate-600">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:shadow-md transition-all"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-sm">
            <Shield className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Admin Panel</h1>
            <p className="text-xs text-slate-400">{health?.admin_email}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 glass-card rounded-xl p-1 max-w-xs">
          {(["health", "users"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-all ${
                activeTab === tab
                  ? "bg-white shadow-sm text-slate-800"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "health" && health && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: "Total Expenses", value: health.total_expenses, Icon: Activity },
                { label: "Active Loans", value: health.total_loans, Icon: Activity },
                { label: "Credit Cards", value: health.total_credit_cards, Icon: Activity },
              ].map(({ label, value, Icon }) => (
                <div key={label} className="glass-card rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-slate-400" />
                    <p className="text-xs text-slate-400">{label}</p>
                  </div>
                  <p className="text-2xl font-semibold text-slate-800">{value}</p>
                </div>
              ))}
            </div>

            {health.last_activity && (
              <div className="glass-card rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">Last activity</p>
                <p className="text-sm text-slate-700">
                  {new Date(health.last_activity).toLocaleString("en-IN")}
                </p>
              </div>
            )}

            <div className="glass-card rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-medium text-slate-700">
                Key Rotation
              </h3>
              <p className="text-xs text-slate-400">
                To rotate the master encryption key, update{" "}
                <code className="bg-white/60 px-1 rounded">
                  MASTER_ENCRYPTION_KEY
                </code>{" "}
                in your Vercel environment variables and run the migration script:
              </p>
              <code className="block text-xs bg-white/60 rounded-lg px-3 py-2 text-slate-600">
                npx ts-node scripts/rotate-key.ts
              </code>
            </div>

            <div className="glass-card rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-medium text-slate-700">
                Access Code
              </h3>
              <p className="text-xs text-slate-400">
                Set{" "}
                <code className="bg-white/60 px-1 rounded">ACCESS_CODE</code>{" "}
                in your Vercel environment variables to change the landing page
                access code. No deployment required — changes take effect on
                next request.
              </p>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/40">
              <Users className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-medium text-slate-700">
                Registered Users ({users.length})
              </h2>
            </div>
            {users.length === 0 ? (
              <p className="text-sm text-slate-400 text-center p-8">
                No users registered
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-white/40">
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/40">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-white/20 transition-colors">
                      <td className="px-4 py-3 text-slate-700">{u.email}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(u.created_at).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X, Trash2, ShoppingBag, CheckCircle2, Ban, RotateCcw } from "lucide-react";
import { decrypt, encrypt } from "@/lib/encryption";
import { useSessionStore } from "@/store/session.store";
import { createBrowserClient } from "@/lib/supabase";
import { formatTaka } from "@/lib/format";

async function getToken(): Promise<string | null> {
  const s = createBrowserClient();
  const { data } = await s.auth.getSession();
  return data.session?.access_token ?? null;
}

interface Item {
  id: string;
  name_encrypted: string;
  budget_encrypted: string;
  status: string;
  notes_encrypted: string | null;
  created_at: string;
}

export default function ProcurementPage() {
  const { sessionKey } = useSessionStore();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    if (!sessionKey) return;
    setLoading(true);
    const token = await getToken();
    const res = await fetch("/api/procurement", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [sessionKey]);

  useEffect(() => {
    load();
  }, [load]);

  function dec(c: string): string {
    try {
      return decrypt(c, sessionKey!);
    } catch {
      return "";
    }
  }
  function decNum(c: string): number {
    return parseInt(dec(c), 10) || 0;
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const token = await getToken();
    await fetch("/api/procurement", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, ...body }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this item?")) return;
    const token = await getToken();
    await fetch(`/api/procurement?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  }

  const planned = items.filter((i) => i.status === "planned");
  const bought = items.filter((i) => i.status === "bought");
  const cancelled = items.filter((i) => i.status === "cancelled");
  const plannedTotal = planned.reduce((s, i) => s + decNum(i.budget_encrypted), 0);

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between anim-rise">
        <div>
          <span className="label-kicker">Wishlist</span>
          <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold mt-1">
            Future Buys
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
            {planned.length} planned · budget {formatTaka(plannedTotal)}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-xl px-5 py-3 font-[family-name:var(--font-mono)] text-[0.78rem] uppercase tracking-[0.18em] text-black font-semibold"
          style={{
            background: "linear-gradient(135deg, #00e5ff, #ff2bd6)",
            boxShadow: "0 10px 30px -10px rgba(0,229,255,0.5)",
          }}
        >
          <Plus className="h-4 w-4" />
          Add item
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 rounded-full border-2 border-[color:var(--color-neon-cyan)]/30 border-t-[color:var(--color-neon-cyan)] animate-spin" />
        </div>
      ) : (
        <>
          <Section title="Planned" items={planned} emptyText="Nothing planned yet — click 'Add item' to start your wishlist.">
            {planned.map((i) => (
              <ItemRow
                key={i.id}
                name={dec(i.name_encrypted)}
                budget={decNum(i.budget_encrypted)}
                notes={i.notes_encrypted ? dec(i.notes_encrypted) : ""}
                status="planned"
                actions={
                  <>
                    <IconBtn
                      title="Mark bought"
                      color="safe"
                      onClick={() => patch(i.id, { status: "bought" })}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn
                      title="Cancel"
                      color="warning"
                      onClick={() => patch(i.id, { status: "cancelled" })}
                    >
                      <Ban className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn title="Remove" color="danger" onClick={() => remove(i.id)}>
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  </>
                }
              />
            ))}
          </Section>

          {bought.length > 0 && (
            <Section title="Bought" items={bought}>
              {bought.map((i) => (
                <ItemRow
                  key={i.id}
                  name={dec(i.name_encrypted)}
                  budget={decNum(i.budget_encrypted)}
                  notes={i.notes_encrypted ? dec(i.notes_encrypted) : ""}
                  status="bought"
                  actions={
                    <>
                      <IconBtn
                        title="Restore to planned"
                        color="cyan"
                        onClick={() => patch(i.id, { status: "planned" })}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn title="Remove" color="danger" onClick={() => remove(i.id)}>
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    </>
                  }
                />
              ))}
            </Section>
          )}

          {cancelled.length > 0 && (
            <Section title="Cancelled" items={cancelled}>
              {cancelled.map((i) => (
                <ItemRow
                  key={i.id}
                  name={dec(i.name_encrypted)}
                  budget={decNum(i.budget_encrypted)}
                  notes={i.notes_encrypted ? dec(i.notes_encrypted) : ""}
                  status="cancelled"
                  actions={
                    <>
                      <IconBtn
                        title="Restore"
                        color="cyan"
                        onClick={() => patch(i.id, { status: "planned" })}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn title="Remove" color="danger" onClick={() => remove(i.id)}>
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    </>
                  }
                />
              ))}
            </Section>
          )}
        </>
      )}

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function Section({
  title,
  items,
  children,
  emptyText,
}: {
  title: string;
  items: unknown[];
  children: React.ReactNode;
  emptyText?: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="label-kicker">{title}</span>
        <span className="text-[0.68rem] text-[color:var(--color-text-muted)] font-[family-name:var(--font-mono)]">
          {items.length}
        </span>
      </div>
      {items.length === 0 && emptyText ? (
        <p className="text-sm text-[color:var(--color-text-muted)] py-6 text-center">{emptyText}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">{children}</div>
      )}
    </section>
  );
}

function ItemRow({
  name,
  budget,
  notes,
  status,
  actions,
}: {
  name: string;
  budget: number;
  notes: string;
  status: string;
  actions: React.ReactNode;
}) {
  const muted = status !== "planned";
  return (
    <div
      className={`glass-card card-ticks rounded-xl p-4 space-y-2 ${
        muted ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-[color:var(--color-text-muted)] shrink-0" />
            <h3
              className={`truncate text-sm font-semibold text-[color:var(--color-text-primary)] ${
                status === "bought" ? "line-through" : ""
              }`}
            >
              {name}
            </h3>
          </div>
          {notes && (
            <p className="mt-1 text-xs text-[color:var(--color-text-muted)] line-clamp-2">
              {notes}
            </p>
          )}
        </div>
        <div
          className="font-[family-name:var(--font-mono)] font-semibold text-base shrink-0"
          style={{ color: "var(--color-neon-cyan)" }}
        >
          {formatTaka(budget)}
        </div>
      </div>
      <div className="flex gap-1 pt-1 border-t border-white/5">{actions}</div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  color,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  color: "safe" | "danger" | "warning" | "cyan";
}) {
  const hoverClass =
    color === "safe"
      ? "hover:text-[color:var(--color-safe)]"
      : color === "danger"
      ? "hover:text-[color:var(--color-danger)]"
      : color === "warning"
      ? "hover:text-[color:var(--color-warning)]"
      : "hover:text-[color:var(--color-neon-cyan)]";
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md text-[color:var(--color-text-muted)] ${hoverClass} hover:bg-white/5 transition-colors`}
    >
      {children}
    </button>
  );
}

function AddModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { sessionKey } = useSessionStore();
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!sessionKey) return;
    if (!name.trim()) return setError("Enter an item name");
    const paise = Math.round(parseFloat(budget || "0") * 100);
    if (paise <= 0) return setError("Enter a positive budget");
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name_encrypted: encrypt(name.trim(), sessionKey),
          budget_encrypted: encrypt(String(paise), sessionKey),
          notes_encrypted: notes.trim() ? encrypt(notes.trim(), sessionKey) : undefined,
        }),
      });
      if (res.ok) onSaved();
      else {
        const e = await res.json();
        setError(typeof e.error === "string" ? e.error : "Failed to save");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "radial-gradient(ellipse at center, rgba(5,5,16,0.75), rgba(5,5,16,0.95))",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="glass-card card-ticks rounded-3xl p-6 w-full max-w-sm space-y-4 anim-rise">
        <div className="flex items-center justify-between">
          <div>
            <span className="label-kicker">Wishlist</span>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-bold">
              Add future buy
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-full border border-white/10 text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-neon-magenta)] hover:border-[color:var(--color-neon-magenta)] transition-colors flex items-center justify-center"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium">Item name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sony WH-1000XM5"
            autoFocus
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[color:var(--color-text-primary)] placeholder-[color:var(--color-text-muted)] outline-none focus:border-[color:var(--color-neon-cyan)]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium">Budget (৳)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="35000"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[color:var(--color-text-primary)] placeholder-[color:var(--color-text-muted)] outline-none focus:border-[color:var(--color-neon-cyan)]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="link, colour, size…"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[color:var(--color-text-primary)] placeholder-[color:var(--color-text-muted)] outline-none focus:border-[color:var(--color-neon-cyan)] resize-none"
          />
        </div>

        {error && <p className="text-sm text-[color:var(--color-danger)]">{error}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl py-3 font-[family-name:var(--font-mono)] text-[0.78rem] uppercase tracking-[0.18em] font-semibold text-black disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #00e5ff, #ff2bd6)",
            boxShadow: "0 10px 30px -10px rgba(0,229,255,0.5)",
          }}
        >
          {saving ? "Saving…" : "Add item"}
        </button>
      </div>
    </div>
  );
}

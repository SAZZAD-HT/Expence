import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

function forbidden() {
  return Response.json({ error: "Forbidden" }, { status: 403 });
}

async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return { user: null, error: unauthorized() };

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || user.email !== adminEmail) {
    return { user: null, error: forbidden() };
  }

  return { user, error: null };
}

export async function GET(req: NextRequest) {
  const { user, error } = await requireAdmin(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "health";

  const supabase = createServerClient();

  if (action === "users") {
    const { data, error: dbErr } = await supabase
      .from("profiles")
      .select("id, email, created_at")
      .order("created_at", { ascending: false });

    if (dbErr) {
      return Response.json({ error: dbErr.message }, { status: 500 });
    }

    return Response.json(data ?? []);
  }

  if (action === "health") {
    const [expCount, loanCount, cardCount] = await Promise.all([
      supabase.from("expenses").select("id", { count: "exact", head: true }),
      supabase.from("loans").select("id", { count: "exact", head: true }),
      supabase.from("credit_cards").select("id", { count: "exact", head: true }),
    ]);

    const { data: lastActivity } = await supabase
      .from("expenses")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return Response.json({
      total_expenses: expCount.count ?? 0,
      total_loans: loanCount.count ?? 0,
      total_credit_cards: cardCount.count ?? 0,
      last_activity: lastActivity?.created_at ?? null,
      admin_email: user!.email,
    });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

const updateAccessCodeSchema = z.object({
  action: z.literal("update_access_code"),
  new_code: z.string().min(8).max(64),
});

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Malformed request body" }, { status: 400 });
  }

  const parsed = updateAccessCodeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Access code rotation requires a Vercel env var update — return instructions
  return Response.json({
    message:
      "To update the access code, set ACCESS_CODE in your Vercel environment variables and redeploy.",
    new_code_preview: `${parsed.data.new_code.slice(0, 3)}***`,
  });
}

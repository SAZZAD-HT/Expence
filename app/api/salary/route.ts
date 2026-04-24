import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase";
import { encryptWithMaster, decryptWithMaster } from "@/lib/encryption";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

const upsertSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  salary_encrypted: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  const supabase = createServerClient();
  let query = supabase
    .from("monthly_salaries")
    .select("id, month, salary_encrypted, created_at")
    .eq("user_id", user.id)
    .order("month", { ascending: false });

  if (month) query = query.eq("month", month);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((r) => ({
    ...r,
    salary_encrypted: decryptWithMaster(r.salary_encrypted as string),
  }));

  return Response.json(month ? (rows[0] ?? null) : rows);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Malformed request body" }, { status: 400 });
  }

  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { month, salary_encrypted } = parsed.data;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("monthly_salaries")
    .upsert(
      {
        user_id: user.id,
        month,
        salary_encrypted: encryptWithMaster(salary_encrypted),
      },
      { onConflict: "user_id,month" }
    )
    .select("id")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}

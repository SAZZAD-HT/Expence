import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase";
import { encryptWithMaster, decryptWithMaster } from "@/lib/encryption";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

const createSchema = z.object({
  amount_encrypted: z.string().min(1),
  source_encrypted: z.string().min(1),
  note_encrypted: z.string().optional(),
  inflow_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function decryptRow(r: Record<string, unknown>) {
  return {
    ...r,
    amount_encrypted: decryptWithMaster(r.amount_encrypted as string),
    source_encrypted: decryptWithMaster(r.source_encrypted as string),
    note_encrypted: r.note_encrypted
      ? decryptWithMaster(r.note_encrypted as string)
      : null,
  };
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM

  const supabase = createServerClient();
  let query = supabase
    .from("cash_inflows")
    .select("id, amount_encrypted, source_encrypted, note_encrypted, inflow_date, created_at")
    .eq("user_id", user.id)
    .order("inflow_date", { ascending: false });

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    query = query.gte("inflow_date", `${month}-01`).lte("inflow_date", `${month}-31`);
  }

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json((data ?? []).map(decryptRow));
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { amount_encrypted, source_encrypted, note_encrypted, inflow_date } = parsed.data;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("cash_inflows")
    .insert({
      user_id: user.id,
      amount_encrypted: encryptWithMaster(amount_encrypted),
      source_encrypted: encryptWithMaster(source_encrypted),
      note_encrypted: note_encrypted ? encryptWithMaster(note_encrypted) : null,
      inflow_date,
    })
    .select("id")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });
  const supabase = createServerClient();
  const { error } = await supabase
    .from("cash_inflows")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}

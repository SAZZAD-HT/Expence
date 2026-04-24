import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase";
import { encryptWithMaster, decryptWithMaster } from "@/lib/encryption";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

const createSchema = z.object({
  card_id: z.string().uuid(),
  name_encrypted: z.string().min(1),
  principal_encrypted: z.string().min(1),
  monthly_amount_encrypted: z.string().min(1),
  tenure_months: z.number().int().positive(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  months_paid: z.number().int().min(0).optional(),
  status: z.enum(["active", "closed"]).optional(),
});

function decryptRow(r: Record<string, unknown>) {
  return {
    ...r,
    name_encrypted: decryptWithMaster(r.name_encrypted as string),
    principal_encrypted: decryptWithMaster(r.principal_encrypted as string),
    monthly_amount_encrypted: decryptWithMaster(r.monthly_amount_encrypted as string),
  };
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const cardId = searchParams.get("card_id");

  const supabase = createServerClient();
  let query = supabase
    .from("card_emis")
    .select(
      "id, card_id, name_encrypted, principal_encrypted, monthly_amount_encrypted, tenure_months, months_paid, start_date, status, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (cardId) query = query.eq("card_id", cardId);

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

  const {
    card_id,
    name_encrypted,
    principal_encrypted,
    monthly_amount_encrypted,
    tenure_months,
    start_date,
  } = parsed.data;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("card_emis")
    .insert({
      user_id: user.id,
      card_id,
      name_encrypted: encryptWithMaster(name_encrypted),
      principal_encrypted: encryptWithMaster(principal_encrypted),
      monthly_amount_encrypted: encryptWithMaster(monthly_amount_encrypted),
      tenure_months,
      start_date,
      months_paid: 0,
      status: "active",
    })
    .select("id")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Malformed request body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...updates } = parsed.data;
  const supabase = createServerClient();
  const { error } = await supabase
    .from("card_emis")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });
  const supabase = createServerClient();
  const { error } = await supabase
    .from("card_emis")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}

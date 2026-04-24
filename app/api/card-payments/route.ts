import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase";
import { encryptWithMaster, decryptWithMaster } from "@/lib/encryption";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

const createSchema = z.object({
  card_id: z.string().uuid(),
  amount_encrypted: z.string().min(1),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note_encrypted: z.string().optional(),
  // Updated card state (client-encrypted with session key, then we wrap)
  new_balance_encrypted: z.string().min(1),
  new_minimum_due_encrypted: z.string().min(1),
});

function decryptRow(r: Record<string, unknown>) {
  return {
    ...r,
    amount_encrypted: decryptWithMaster(r.amount_encrypted as string),
    note_encrypted: r.note_encrypted
      ? decryptWithMaster(r.note_encrypted as string)
      : null,
  };
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const cardId = searchParams.get("card_id");

  const supabase = createServerClient();
  let query = supabase
    .from("card_payments")
    .select("id, card_id, amount_encrypted, payment_date, note_encrypted, created_at")
    .eq("user_id", user.id)
    .order("payment_date", { ascending: false });

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
    amount_encrypted,
    payment_date,
    note_encrypted,
    new_balance_encrypted,
    new_minimum_due_encrypted,
  } = parsed.data;

  const supabase = createServerClient();

  const { error: insertErr } = await supabase.from("card_payments").insert({
    user_id: user.id,
    card_id,
    amount_encrypted: encryptWithMaster(amount_encrypted),
    payment_date,
    note_encrypted: note_encrypted ? encryptWithMaster(note_encrypted) : null,
  });
  if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 });

  const { error: updateErr } = await supabase
    .from("credit_cards")
    .update({
      current_balance_encrypted: encryptWithMaster(new_balance_encrypted),
      minimum_due_encrypted: encryptWithMaster(new_minimum_due_encrypted),
    })
    .eq("id", card_id)
    .eq("user_id", user.id);
  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });

  return Response.json({ ok: true }, { status: 201 });
}

const deleteSchema = z.object({
  id: z.string().uuid(),
  card_id: z.string().uuid(),
  new_balance_encrypted: z.string().min(1),
  new_minimum_due_encrypted: z.string().min(1),
});

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Malformed request body" }, { status: 400 });
  }

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, card_id, new_balance_encrypted, new_minimum_due_encrypted } = parsed.data;
  const supabase = createServerClient();

  const { error: delErr } = await supabase
    .from("card_payments")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (delErr) return Response.json({ error: delErr.message }, { status: 500 });

  const { error: updateErr } = await supabase
    .from("credit_cards")
    .update({
      current_balance_encrypted: encryptWithMaster(new_balance_encrypted),
      minimum_due_encrypted: encryptWithMaster(new_minimum_due_encrypted),
    })
    .eq("id", card_id)
    .eq("user_id", user.id);
  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });

  return new Response(null, { status: 204 });
}

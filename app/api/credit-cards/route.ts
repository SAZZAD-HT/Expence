import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase";
import { encryptWithMaster, decryptWithMaster } from "@/lib/encryption";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

const createSchema = z.object({
  card_name_encrypted: z.string().min(1),
  credit_limit_encrypted: z.string().min(1),
  billing_cycle_day: z.number().int().min(1).max(31),
  interest_free_days: z.number().int().positive().optional(),
  current_balance_encrypted: z.string().min(1),
  minimum_due_encrypted: z.string().min(1),
  existing_emi_count: z.number().int().min(0).optional(),
  existing_emi_amount_encrypted: z.string().optional(),
});

const updateSchema = createSchema.partial().extend({
  id: z.string().uuid(),
});

function decryptCard(row: Record<string, unknown>) {
  return {
    ...row,
    card_name_encrypted: decryptWithMaster(row.card_name_encrypted as string),
    credit_limit_encrypted: decryptWithMaster(row.credit_limit_encrypted as string),
    current_balance_encrypted: decryptWithMaster(row.current_balance_encrypted as string),
    minimum_due_encrypted: decryptWithMaster(row.minimum_due_encrypted as string),
    existing_emi_amount_encrypted: row.existing_emi_amount_encrypted
      ? decryptWithMaster(row.existing_emi_amount_encrypted as string)
      : null,
  };
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("credit_cards")
    .select(
      "id, card_name_encrypted, credit_limit_encrypted, billing_cycle_day, interest_free_days, current_balance_encrypted, minimum_due_encrypted, existing_emi_count, existing_emi_amount_encrypted, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json((data ?? []).map(decryptCard));
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
    card_name_encrypted,
    credit_limit_encrypted,
    current_balance_encrypted,
    minimum_due_encrypted,
    existing_emi_amount_encrypted,
    ...rest
  } = parsed.data;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("credit_cards")
    .insert({
      user_id: user.id,
      card_name_encrypted: encryptWithMaster(card_name_encrypted),
      credit_limit_encrypted: encryptWithMaster(credit_limit_encrypted),
      current_balance_encrypted: encryptWithMaster(current_balance_encrypted),
      minimum_due_encrypted: encryptWithMaster(minimum_due_encrypted),
      existing_emi_amount_encrypted: existing_emi_amount_encrypted
        ? encryptWithMaster(existing_emi_amount_encrypted)
        : null,
      ...rest,
    })
    .select("id")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

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

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    id,
    card_name_encrypted,
    credit_limit_encrypted,
    current_balance_encrypted,
    minimum_due_encrypted,
    existing_emi_amount_encrypted,
    ...rest
  } = parsed.data;

  const updates: Record<string, unknown> = { ...rest };
  if (card_name_encrypted) updates.card_name_encrypted = encryptWithMaster(card_name_encrypted);
  if (credit_limit_encrypted) updates.credit_limit_encrypted = encryptWithMaster(credit_limit_encrypted);
  if (current_balance_encrypted) updates.current_balance_encrypted = encryptWithMaster(current_balance_encrypted);
  if (minimum_due_encrypted) updates.minimum_due_encrypted = encryptWithMaster(minimum_due_encrypted);
  if (existing_emi_amount_encrypted) {
    updates.existing_emi_amount_encrypted = encryptWithMaster(existing_emi_amount_encrypted);
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("credit_cards")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("credit_cards")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}

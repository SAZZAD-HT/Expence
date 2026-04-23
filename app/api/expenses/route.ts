import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase";
import { encryptWithMaster, decryptWithMaster } from "@/lib/encryption";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

const createSchema = z.object({
  amount_encrypted: z.string().min(1),
  category_id: z.string().uuid().nullable().optional(),
  payment_method: z.enum(["cash", "debit_card", "credit_card"]),
  credit_card_id: z.string().uuid().nullable().optional(),
  description_encrypted: z.string().optional(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM

  const supabase = createServerClient();
  let query = supabase
    .from("expenses")
    .select(
      "id, amount_encrypted, category_id, payment_method, credit_card_id, description_encrypted, expense_date, created_at"
    )
    .eq("user_id", user.id)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (month) {
    query = query
      .gte("expense_date", `${month}-01`)
      .lte("expense_date", `${month}-31`);
  }

  const { data, error } = await query.limit(200);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const decrypted = (data ?? []).map((row) => ({
    ...row,
    amount_encrypted: decryptWithMaster(row.amount_encrypted),
    description_encrypted: row.description_encrypted
      ? decryptWithMaster(row.description_encrypted)
      : null,
  }));

  return Response.json(decrypted);
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

  const { amount_encrypted, description_encrypted, ...rest } = parsed.data;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: user.id,
      amount_encrypted: encryptWithMaster(amount_encrypted),
      description_encrypted: description_encrypted
        ? encryptWithMaster(description_encrypted)
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
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}

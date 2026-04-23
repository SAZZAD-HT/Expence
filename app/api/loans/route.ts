import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase";
import { encryptWithMaster, decryptWithMaster } from "@/lib/encryption";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

const createSchema = z.object({
  loan_name_encrypted: z.string().min(1),
  principal_encrypted: z.string().min(1),
  interest_rate_encrypted: z.string().min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tenure_months: z.number().int().positive(),
  emi_amount_encrypted: z.string().min(1),
  segment_id: z.string().uuid().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("loans")
    .select(
      "id, loan_name_encrypted, principal_encrypted, interest_rate_encrypted, start_date, tenure_months, emi_amount_encrypted, segment_id, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const decrypted = (data ?? []).map((row) => ({
    ...row,
    loan_name_encrypted: decryptWithMaster(row.loan_name_encrypted),
    principal_encrypted: decryptWithMaster(row.principal_encrypted),
    interest_rate_encrypted: decryptWithMaster(row.interest_rate_encrypted),
    emi_amount_encrypted: decryptWithMaster(row.emi_amount_encrypted),
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

  const {
    loan_name_encrypted,
    principal_encrypted,
    interest_rate_encrypted,
    emi_amount_encrypted,
    ...rest
  } = parsed.data;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("loans")
    .insert({
      user_id: user.id,
      loan_name_encrypted: encryptWithMaster(loan_name_encrypted),
      principal_encrypted: encryptWithMaster(principal_encrypted),
      interest_rate_encrypted: encryptWithMaster(interest_rate_encrypted),
      emi_amount_encrypted: encryptWithMaster(emi_amount_encrypted),
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
    .from("loans")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}

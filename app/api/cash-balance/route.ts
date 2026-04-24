import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase";
import { encryptWithMaster, decryptWithMaster } from "@/lib/encryption";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

const upsertSchema = z.object({
  balance_encrypted: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("cash_balances")
    .select("user_id, balance_encrypted, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json(null);

  return Response.json({
    ...data,
    balance_encrypted: decryptWithMaster(data.balance_encrypted as string),
  });
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

  const supabase = createServerClient();
  const { error } = await supabase
    .from("cash_balances")
    .upsert(
      {
        user_id: user.id,
        balance_encrypted: encryptWithMaster(parsed.data.balance_encrypted),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

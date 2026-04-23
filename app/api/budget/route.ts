import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase";
import { encryptWithMaster, decryptWithMaster } from "@/lib/encryption";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  monthly_limit_encrypted: z.string().min(1),
  color_tag: z.string().optional(),
  is_fixed_cost: z.boolean().optional(),
});

const updateSchema = createSchema.partial().extend({
  id: z.string().uuid(),
});

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("budget_segments")
    .select("id, name, monthly_limit_encrypted, color_tag, is_fixed_cost, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const decrypted = (data ?? []).map((row) => ({
    ...row,
    monthly_limit_encrypted: decryptWithMaster(row.monthly_limit_encrypted),
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

  const { monthly_limit_encrypted, ...rest } = parsed.data;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("budget_segments")
    .insert({
      user_id: user.id,
      monthly_limit_encrypted: encryptWithMaster(monthly_limit_encrypted),
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

  const { id, monthly_limit_encrypted, ...rest } = parsed.data;

  const updates: Record<string, unknown> = { ...rest };
  if (monthly_limit_encrypted) {
    updates.monthly_limit_encrypted = encryptWithMaster(monthly_limit_encrypted);
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("budget_segments")
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
    .from("budget_segments")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}

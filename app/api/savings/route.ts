import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase";
import { encryptWithMaster, decryptWithMaster } from "@/lib/encryption";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

const createSchema = z.object({
  name_encrypted: z.string().min(1),
  target_amount_encrypted: z.string().min(1),
  current_amount_encrypted: z.string().min(1),
  notes_encrypted: z.string().optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  name_encrypted: z.string().min(1).optional(),
  target_amount_encrypted: z.string().min(1).optional(),
  current_amount_encrypted: z.string().min(1).optional(),
  notes_encrypted: z.string().optional(),
});

function decryptRow(r: Record<string, unknown>) {
  return {
    ...r,
    name_encrypted: decryptWithMaster(r.name_encrypted as string),
    target_amount_encrypted: decryptWithMaster(r.target_amount_encrypted as string),
    current_amount_encrypted: decryptWithMaster(r.current_amount_encrypted as string),
    notes_encrypted: r.notes_encrypted
      ? decryptWithMaster(r.notes_encrypted as string)
      : null,
  };
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("savings_goals")
    .select(
      "id, name_encrypted, target_amount_encrypted, current_amount_encrypted, notes_encrypted, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

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

  const { name_encrypted, target_amount_encrypted, current_amount_encrypted, notes_encrypted } =
    parsed.data;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("savings_goals")
    .insert({
      user_id: user.id,
      name_encrypted: encryptWithMaster(name_encrypted),
      target_amount_encrypted: encryptWithMaster(target_amount_encrypted),
      current_amount_encrypted: encryptWithMaster(current_amount_encrypted),
      notes_encrypted: notes_encrypted ? encryptWithMaster(notes_encrypted) : null,
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

  const { id, name_encrypted, target_amount_encrypted, current_amount_encrypted, notes_encrypted } =
    parsed.data;
  const updates: Record<string, unknown> = {};
  if (name_encrypted) updates.name_encrypted = encryptWithMaster(name_encrypted);
  if (target_amount_encrypted)
    updates.target_amount_encrypted = encryptWithMaster(target_amount_encrypted);
  if (current_amount_encrypted)
    updates.current_amount_encrypted = encryptWithMaster(current_amount_encrypted);
  if (notes_encrypted !== undefined) {
    updates.notes_encrypted = notes_encrypted ? encryptWithMaster(notes_encrypted) : null;
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("savings_goals")
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
    .from("savings_goals")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}

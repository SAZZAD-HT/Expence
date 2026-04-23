import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export async function getAuthUser(req: NextRequest): Promise<User | null> {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return null;

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  return user ?? null;
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

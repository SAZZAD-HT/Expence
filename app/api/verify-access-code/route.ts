import { NextRequest } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  code: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Malformed request body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Malformed request body" }, { status: 400 });
  }

  const { code } = parsed.data;
  const accessCode = process.env.ACCESS_CODE;

  if (!accessCode || code !== accessCode) {
    return Response.json({ error: "Invalid access code" }, { status: 401 });
  }

  return Response.json({ success: true }, { status: 200 });
}

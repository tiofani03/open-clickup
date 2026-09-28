import type { Context } from "hono";
import { ZodType } from "zod";
import { ApiError } from "@/lib/api-helpers";

export async function readJson<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ");
    throw new ApiError(400, msg);
  }
  return parsed.data;
}

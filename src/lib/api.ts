import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as Record<string, unknown>, init);
}

export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function tooManyRequests(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: `Too many requests. Try again in ${retryAfterSeconds}s.` },
    { status: 429, headers: { "retry-after": String(retryAfterSeconds) } },
  );
}

/**
 * Turns thrown errors into a JSON body.
 *
 * Only messages from errors we raised deliberately are echoed back; anything
 * else could carry RPC endpoints or upstream credentials, so it is logged
 * server-side and reported generically.
 */
export function handleError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    const detail = error.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ");
    return fail(detail, 422);
  }

  const named = error as { name?: string; message?: string };
  if (named?.name === "LaunchError" || named?.name === "PayoutError") {
    return fail(named.message ?? "Request failed", 400);
  }

  console.error("[api]", error);
  return fail("Something went wrong. Please try again.", 500);
}

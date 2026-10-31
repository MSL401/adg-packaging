import { NextResponse } from "next/server";
import { AccessError } from "@/lib/auth/access";

/** Wrap a route handler: access errors → 403, anything else → 500 with a message. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response> | Response) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof AccessError) return NextResponse.json({ error: e.message }, { status: 403 });
      console.error(e);
      return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
    }
  };
}

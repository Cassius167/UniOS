import { NextResponse } from "next/server";
import { aiStatus } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

/** Reports whether an AI provider is configured. Never returns the key. */
export function GET() {
  return NextResponse.json(aiStatus());
}

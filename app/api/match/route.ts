// /api/match — 매칭 한 번 돌리기 (lib/server/match.ts)
//
// POST  앱에서 부름: 데모 버튼, 심사위원이 설정을 끝낸 직후
//   body (모두 선택): { now?: "2026-10-26T15:20:00-04:00", dryRun?: true }
//   now 를 안 주면 데모 시계(app_clock) 기준 지금. dryRun 이면 DB에 방을 쓰지 않고 결과만 보여줌
// GET   5분 타이머(Supabase pg_cron)가 부름. CRON_SECRET 이 설정돼 있으면
//   Authorization: Bearer <CRON_SECRET> 헤더가 있어야 함
//
// 같은 사람을 같은 활동에 두 번 초대하지 않으니, 여러 번 눌러도 방이 겹치지 않는다.

import { NextResponse } from "next/server";
import { fail } from "@/lib/server/api";
import { runMatch } from "@/lib/server/match";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// Claude 호출 두 번(장소, 문구)에 시간이 걸림
export const maxDuration = 60;

async function handle(opts: { now?: string; dryRun?: boolean }) {
  if (!process.env.ANTHROPIC_API_KEY) return fail(500, "NO_API_KEY", "ANTHROPIC_API_KEY is not set on the server.");
  try {
    const sb = await createClient();
    return NextResponse.json(await runMatch(sb, opts));
  } catch (e) {
    console.error("[match]", e);
    return fail(500, "MATCH_FAILED", (e as Error).message);
  }
}

export async function POST(req: Request) {
  const raw = await req.json().catch(() => ({}));
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (body.now !== undefined && (typeof body.now !== "string" || Number.isNaN(Date.parse(body.now)))) {
    return fail(400, "BAD_REQUEST", 'now must be an ISO timestamp like "2026-10-26T15:20:00-04:00".');
  }
  return handle({ now: body.now as string | undefined, dryRun: body.dryRun === true });
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail(401, "UNAUTHORIZED", "Missing or wrong cron secret.");
  }
  return handle({});
}

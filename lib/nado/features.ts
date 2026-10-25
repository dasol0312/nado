// 학생이 직접 쓰는 Claude 기능 3개 (lib/ai.ts 에서 연결)
//   readAlbert       Albert 시간표 캡처 → 수업 목록 (이미지, 기본 모델)
//   thinkInterest    직접 입력한 관심사 → 카테고리, 최대/기본 최소 인원, 이유 (기본 모델)
//   icebreaker       "Another question" → 질문 한 문장 (빠른 모델)
// 검증과 범위 자르기는 부르는 라우트가 한다. 여기서는 Claude에게 묻고 답을 꺼내서 돌려주기만 한다.
// Claude에는 학생 이름이나 ID를 넘기지 않는다.

import Anthropic from "@anthropic-ai/sdk";
import { makeClient, parseJson } from "./claude";
import {
  ALBERT_SYSTEM, type AlbertResult,
  icebreakerUser, interestSystem, type InterestResult,
} from "./prompts";

const MODEL = "claude-sonnet-5-5";      // 이미지, 관심사 고민
const FAST_MODEL = "claude-haiku-5-5";  // 아이스브레이커

let client: Anthropic | null = null;
const getClient = () => (client ??= makeClient());

// Claude가 이미지를 거절했거나(400/422, refusal) 요청 한도(429)일 때 lib/ai.ts 가 문구를 고를 수 있게
export class ClaudeCallError extends Error {
  constructor(public kind: "rejected" | "rate_limited" | "failed", message: string) {
    super(message);
  }
}
function classify(e: unknown): ClaudeCallError {
  if (e instanceof ClaudeCallError) return e;
  if (e instanceof Anthropic.APIError) {
    if (e.status === 429) return new ClaudeCallError("rate_limited", e.message);
    if (e.status === 400 || e.status === 413 || e.status === 422) return new ClaudeCallError("rejected", e.message);
  }
  return new ClaudeCallError("failed", (e as Error)?.message ?? String(e));
}

const textOf = (res: Anthropic.Message) => res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();

export async function readAlbert(image: { data: string; mediaType: string }): Promise<AlbertResult["classes"]> {
  try {
    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: ALBERT_SYSTEM,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: image.mediaType as "image/png" | "image/jpeg" | "image/webp", data: image.data },
          },
          { type: "text", text: "Read the weekly classes in this schedule." },
        ],
      }],
    });
    if (res.stop_reason === "refusal") throw new ClaudeCallError("rejected", "Claude declined the image.");
    const parsed = parseJson<AlbertResult>(textOf(res));
    if (!parsed) throw new ClaudeCallError("failed", "Claude's answer wasn't JSON.");
    return Array.isArray(parsed.classes) ? parsed.classes : [];
  } catch (e) {
    throw classify(e);
  }
}

// 캐시 없음: "Ask Claude to rethink" 도 매번 새로 생각한다
export async function thinkInterest(name: string, categories: readonly string[]): Promise<InterestResult | null> {
  try {
    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: 600,
      system: interestSystem(categories),
      messages: [{ role: "user", content: `<activity>${name.slice(0, 40)}</activity>` }],
    });
    return parseJson<InterestResult>(textOf(res));
  } catch (e) {
    throw classify(e);
  }
}

export async function icebreaker(q: { people: number; label: string; previous: string }): Promise<string | null> {
  try {
    const res = await getClient().messages.create({
      model: FAST_MODEL,
      max_tokens: 120,
      messages: [{ role: "user", content: icebreakerUser(q) }],
    });
    const text = textOf(res).replace(/^["“”']+|["“”']+$/g, "").trim();
    return text || null;
  } catch (e) {
    throw classify(e);
  }
}

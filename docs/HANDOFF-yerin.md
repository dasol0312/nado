# 예린님께: 남은 AI 기능 + 매칭 규칙 안내

기준: 「Nado 개발 명세서」(2026-10-25)와 main의 v4.1 매칭(`lib/server/match.ts`, `lib/nado/plan.ts`).
새 화면은 main 매칭 위에 올려 두었어요. 실제 DB(800명)로 매칭 → Nado! → 확정 → 방 → 해산 → 재매칭까지 돌려서 확인했어요.

| | 할 일 | 어디서 | 급한 정도 |
|---|---|---|---|
| A | AI 기능 3개 만들기 | `lib/nado/`에 새 파일 → `lib/ai.ts`에서 연결 | 데모 전 |
| B | 매칭 규칙 다듬기 | `lib/nado/matching.ts`, `supabase/migrations/20261025_match_helpers.sql` | 가능하면 |

main에서 이미 끝난 것(할 필요 없음):
- 장소 고르기, 장소 이유, 초대 문구, 첫 아이스브레이커 (`lib/nado/plan.ts`)
- 각자 최소 인원, 활동별 최대 인원, 수업 끝나는 시각에 시작, 실제 학생이 있는 방만
- 1000줄 제한 (`build_activity_slots` DB 함수, `selectAll`)

---

## 0. 화면 쪽에서 매칭을 쓰는 방식

```
POST /api/match            ← "Check again now", 프로필 변경, 방이 열린 뒤, 해산 1.8초 뒤
GET  /api/match            ← pg_cron 5분 타이머 (main 그대로)
        │  main의 runMatch: 방 + room_members(invited) 저장
        ▼
Realtime → 폰에 푸시 배너 → Nado!(joined) → Confirm(confirmed)
        │  lib/match/rules.ts settle()  (lib/server/rooms.ts에서 호출)
        ▼
모두 확정 또는 마감(confirm_by) 지남 + 최소 인원 이상 → rooms.status = 'confirmed' (방 열림)
최소 인원 아래로 떨어짐 → rooms.status = 'cancelled' (해산, 그 시간 다시 매칭)
```

화면은 `/api/match` 응답의 `rooms[].members`로 "나한테 온 새 플랜"을 판단해요. 응답 형식을 바꾸면 알려주세요.
`/api/open-rooms`는 새 흐름에서 더 이상 안 불러요.

---

## A. AI 기능 3개

**연결 방법**: `lib/ai.ts`에 함수 3개가 자리만 있고 지금은 `null`을 돌려줘요(`null`이면 화면이 기본값으로 동작해요). `lib/nado/`에 함수를 만들고, `lib/ai.ts`의 해당 함수 안에서 불러서 결과를 그대로 돌려주면 끝이에요. 기존 `askJson`(lib/nado/claude.ts)을 그대로 쓰면 돼요.

```ts
// lib/ai.ts (예시: 1번 연결)
import { readAlbert } from "@/lib/nado/schedule";
export async function readAlbertSchedule(image) {
  return readAlbert(image);
}
```

공통: 출력 검증과 범위 자르기는 제 쪽 라우트가 해요. Claude에 학생 이름·ID는 넘어가지 않아요.

### A-1. Albert 캡처 읽기 · `readAlbertSchedule(image)`

| | |
|---|---|
| 부르는 곳 | `POST /api/schedule/read` (Profile의 업로드 박스) |
| 입력 | `{ data: base64, mediaType: "image/png" \| "image/jpeg" \| "image/webp" }` (5MB 이하) |
| 출력 | `[{ course, day: "Mon"…"Sun", start: "HH:MM", end: "HH:MM" }]` |
| 프롬프트 | 명세서 「Albert 캡처 읽기」 그대로, 기본 모델(이미지) |
| 시간표가 아니면 | `[]` |

오류는 `lib/ai.ts`의 `AiError`로 던지면 학생이 보는 문구가 달라져요.

| 상황 | 할 일 |
|---|---|
| Claude 연결 없음 | `null` 반환 |
| 이미지를 보낼 수 없음 | `throw new AiError("images_unavailable")` |
| 거절 / 이미지 못 씀 | `throw new AiError("rejected")` |
| 요청 한도 | `throw new AiError("rate_limited")` |

### A-2. 직접 입력 관심사 · `thinkAboutInterest({ name, categories })`

| | |
|---|---|
| 부르는 곳 | `POST /api/activities` (직접 입력 추가, 시트의 "Ask Claude to rethink") |
| 출력 | `{ label, cat, max, min, reason }` |
| 프롬프트 | 명세서 「새 키워드 고민」의 1~3, 6단계만. 4~5단계(장소)는 빼 주세요 |
| 캐시 | rethink도 같은 함수예요. 캐시 없이 다시 생각하게 해 주세요 |

장소는 main 설계대로 그 활동의 첫 플랜이 열릴 때 `choosePlaces`가 골라요. 그래서 여기서는 장소를 비워 둬요.
제 쪽 검증: `cat`이 목록에 있는지, `max` 2~12, `min` 2~max. rethink로 max가 줄면 학생들 최소 인원도 같이 줄여요.

선택: 명세서의 "bubble tea → boba" 같은 이름 정리, 차별 조건 제거를 이 단계에 합치면 좋아요. 지금 main 매칭은 `activityMap: {}`라서 이름 정리를 안 해요.

### A-3. 추가 아이스브레이커 · `nextIcebreaker({ people, label, previous })`

| | |
|---|---|
| 부르는 곳 | `POST /api/rooms/[roomId]/icebreaker` ("Another question"을 누를 때만) |
| 출력 | 질문 한 문장 (160자에서 잘림) |
| 프롬프트 | 명세서 「아이스브레이커」, 빠른 모델, 캐시 없음 |
| 실패 시 | `lib/catalog.ts`의 활동별 질문 목록 |

---

## B. 매칭 규칙 다듬기 (main 코드)

명세서와 아직 다른 곳이에요. 중요한 순서예요.

### B-1. 취소한 사람이 같은 시간에 다시 매칭됨

- `build_activity_slots`(match_helpers.sql)는 `r.status <> 'cancelled'`이면서 `m.status in ('invited','joined','confirmed')`인 방 시간만 바쁜 시간으로 빼요.
- 그래서 "Can't make it"으로 빠진 사람(`room_members.status = 'cancelled'`)이 해산 직후 재매칭에서 **같은 시간에 다시 들어갈 수 있어요.** 명세서는 그 시간 제외예요.
- 제안: busy CTE에 `or m.status = 'cancelled'`(방 상태와 관계없이) 조건을 추가해 주세요.

### B-2. 약속 길이 60~120분 → 60분 고정

`lib/nado/matching.ts`의 `MAX_MINUTES = 120` → `60`. 테스트로 확인했을 때 12:15–2pm(105분) 방이 나왔어요.

### B-3. 학생당 최대 3개 · 다른 활동 먼저 · 시간대 점수

- 지금은 실제 학생이 있는 방 우선, 그다음 큰 방부터예요.
- 명세서: 점수 = 팀 크기 / 최대 인원 + 같은 키워드 후보 수 × 0.01 + 시간대 적합도 + (수업 직후면 0.15). 학생당 최대 3개, 서로 안 겹치게, 다른 활동부터.
- 시간대 적합도: Food 11:30~14:00·17:30~20:30 +0.5 / Cafe 13:30~17:30 +0.35, 10:00~13:30 +0.15 / Sports 15:00~20:00 +0.3 / Study 9:00~12:00·19:00~23:00 +0.25, 그 외 +0.1 / Culture 17:00~23:00 +0.3 / Games 16:00~23:00 +0.25

### B-4. (팀 결정) 시작까지 여유: 20분(main) / 5분(명세서)

`lib/server/match.ts`의 `LEAD_MINUTES = 20`이에요. 팀이 정하면 숫자만 바꾸면 돼요.

### B-5. (팀 결정) 매칭 단위: 같은 활동 / 같은 카테고리

지금은 같은 활동만 묶어요.

---

## 확인 방법

```sh
npx tsx lib/nado/matching.test.ts
npx tsx lib/match/rules.test.ts        # 방 열림/해산 규칙
npm run typecheck && npm run lint && npm run build
npm run dev
# DB에 안 쓰고 매칭 결과만 보기 (월 11:50 기준):
curl -X POST localhost:3000/api/match -H 'Content-Type: application/json' -d '{"dryRun":true,"now":"2026-10-26T11:50:00-04:00"}'
# 화면 흐름: 로그인 → Profile에서 관심사 → Matches "Check again now" → Nado! → Groups에서 Confirm
```

관련 코드: `lib/ai.ts`, `lib/server/rooms.ts`, `lib/match/rules.ts`, `app/api/activities/`, `app/api/schedule/read/`. 궁금한 점은 다솔에게 물어봐 주세요.

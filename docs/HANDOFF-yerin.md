# 예린님께: AI 기능 연결 + 매칭 수정 안내

기준: 「Nado 개발 명세서」(2026-10-25). 앱 화면과 DB는 명세서대로 옮겨 두었고, **예린님 코드(`lib/nado/`, `app/api/open-rooms/`)는 한 줄도 안 바꿨어요.**
남은 일은 두 가지예요.

| | 할 일 | 어디서 | 급한 정도 |
|---|---|---|---|
| A | AI 기능 4개 만들기 | `lib/nado/`에 새 파일 → `lib/ai.ts`에서 연결 | 데모 전 |
| B | 매칭 규칙 맞추기 | `lib/nado/matching.ts`, `app/api/open-rooms/route.ts` | B-1은 데모 전, 나머지는 가능하면 |

---

## 0. 지금 구조에서 예린님 코드가 쓰이는 방식

```
학생 입력: 바쁜 시간(busy_blocks) + 관심사(interests, 최소 인원)
        │
POST /api/match  (lib/match/run.ts, 다솔)
  1) 스냅샷: "지금~4시간 + 1시간 동안 비는 시간 × 관심사" → activity_slots (이번 주 줄)
     · 수업은 분 단위, Fixed/Never 칸, 이미 잡힌 약속, 취소한 시간은 바쁜 시간으로 뺌
     · 샘플 학생은 실제 학생과 같은 활동·같은 시간(1시간 이상)일 때만 넣음
  2) POST /api/open-rooms  ← 예린님 코드 그대로 (Claude ① 이름 정리 → ② openRooms → ③ 초대·아이스브레이커)
  3) 후처리: 각자 최소 인원 적용, 활동별 최대 인원, 만날 곳·활동 장소, 확정 마감
     · 샘플 학생만 남은 방은 지움
```

예린님 쪽에 영향 있는 변경은 이것뿐이에요.
- `lib/activities.ts`의 `PRESET_ACTIVITIES`는 이제 `lib/catalog.ts`(기본 활동 16개)에서 만들어요.
- `lib/time.ts`의 캠퍼스 시간대는 `America/New_York`이에요.
- `activity_slots`는 사람이 칠하지 않아요. `/api/match`가 매번 다시 써요.
- 해산된 방은 `rooms.status = 'cancelled'`예요. `studentsWithRoomsOn`이 이 방을 빼고 보니까 그 멤버들이 다시 매칭 대상이 돼요.

---

## A. AI 기능 4개

**연결 방법**: `lib/ai.ts`에 함수 4개가 자리만 있고 지금은 `null`을 돌려줘요. `null`이면 앱이 기본값으로 동작해요.
`lib/nado/`에 함수를 만들고, `lib/ai.ts`의 해당 함수 안에서 불러서 결과를 그대로 돌려주면 끝이에요.
입력 형식과 출력 타입은 `lib/ai.ts`에 정의돼 있어요.

```ts
// lib/ai.ts (예시: 1번 연결)
import { readAlbert } from "@/lib/nado/schedule";
export async function readAlbertSchedule(image) {
  return readAlbert(image);
}
```

**공통 규칙**
- 출력 검증과 범위 자르기는 제 쪽(라우트)에서 다 해요. 예린님 함수는 Claude 답을 파싱해서 돌려주기만 하면 돼요.
- 실패하면 `null`을 돌려주거나 오류를 던지면 돼요. 화면은 항상 기본값으로 이어가요.
- Claude에는 학생 이름이나 ID를 넘기지 않아요. 입력에도 없어요.
- 클라이언트는 기존 `makeClient()`(lib/nado/claude.ts)를 그대로 쓰면 돼요. 모델 등급은 명세서 표대로예요(이미지·키워드 = 기본, 장소 이유·아이스브레이커 = 빠른 모델).

### A-1. Albert 캡처 읽기 · `readAlbertSchedule(image)`

| | |
|---|---|
| 부르는 곳 | `POST /api/schedule/read` (Profile의 업로드 박스) |
| 입력 | `{ data: base64, mediaType: "image/png" \| "image/jpeg" \| "image/webp" }` (5MB 이하) |
| 출력 | `AlbertClass[]` = `[{ course, day: "Mon"…"Sun", start: "HH:MM", end: "HH:MM" }]` |
| 프롬프트 | 명세서 「Albert 캡처 읽기」 그대로 |
| 시간표가 아니면 | `[]` (화면: "No classes found in that image…") |

화면 오류 문구는 던지는 오류로 골라요. `lib/ai.ts`의 `AiError`를 쓰면 돼요.

| 상황 | 할 일 | 학생이 보는 문구 |
|---|---|---|
| Claude 연결 없음 | `null` 반환 | Claude isn’t connected yet… |
| 이미지를 보낼 수 없음 | `throw new AiError("images_unavailable")` | Claude is connected, but images can’t be sent… |
| Claude가 거절 / 이미지 못 씀 | `throw new AiError("rejected")` | Claude couldn’t use that image… |
| 요청 한도 | `throw new AiError("rate_limited")` | Too many requests right now… |

제 쪽 검증: 요일이 7개 중 하나인지, `H:MM`/`HH:MM` 형식인지, 끝 시각이 시작보다 뒤인지 보고, 과목명은 60자에서 잘라요.

### A-2. 새 키워드 고민 · `thinkAboutInterest(q)`

| | |
|---|---|
| 부르는 곳 | `POST /api/activities` (직접 입력 추가, 시트의 "Ask Claude to rethink") |
| 입력 | `{ name, categories, campus: [{key,name}], places: [{key,name,address}], nsStreets, ewStreets }` |
| 출력 | 명세서 JSON 그대로: `{ label, cat, max, min, meet, place, venue: { name, address, ns, ew, far, confident }, reason }` |
| 프롬프트 | 명세서 「새 키워드 고민」 6단계. 캠퍼스 건물·장소 목록·길 이름은 입력으로 넘어가요 |
| 캐시 | rethink일 때도 같은 함수가 불려요. 캐시 없이 다시 생각하게 해 주세요 |

제 쪽 처리:
- `cat`이 목록에 있는지 확인, `max`는 2~12, `min`은 2~max로 잘라요.
- `meet`는 캠퍼스 건물 키만, `place`는 아는 장소 키만 받아요.
- `place`가 null이고 `venue`가 있으면 `places`에 새 장소(`ai_<이름>`)로 저장해요. 길 이름으로 지도에 핀을 꽂고, `far`면 지도 가장자리에 화살표를 그려요.
- 방 화면에 "Suggested by Claude · check it’s open before you go"가 나와요(`confident:false`면 "as a general spot"이 붙어요).
- 결과는 `activities` 테이블에 키워드별로 저장돼서 다음부터 재사용돼요.

선택: 명세서 「실제 앱에서 웹 검색 켜기」(web_search 도구, `max_uses: 3`)를 이 함수에 붙이면 지금 영업 중인 장소를 찾을 수 있어요.

### A-3. 장소 이유 · `explainPlace(q)`

| | |
|---|---|
| 부르는 곳 | `lib/match/run.ts`의 `settleRoom` (모두 확정해서 방이 열리는 순간 한 번) |
| 입력 | `{ people, label, range: "12–1pm", meet: {name,address}, dest: {name,address}, same, walkMinutes }` |
| 출력 | 한두 문장 문자열. `rooms.place_reason`에 저장돼요 |
| 프롬프트 | 명세서 「장소 이유」. `same`이 true면 "then walk…" 부분은 빼 주세요 |
| 실패 시 | 규칙 문장(`fallbackPlaceReason`) |

명세서의 "CLAUDE / AI" 표시를 구분하려면 `rooms`에 `place_reason_by_ai boolean` 컬럼이 하나 더 필요해요. 지금은 항상 "AI"로 나와요. 필요하면 말해 주세요.

### A-4. 아이스브레이커 · `nextIcebreaker(q)`

| | |
|---|---|
| 부르는 곳 | `POST /api/rooms/[roomId]/icebreaker` ("Another question"을 누를 때만) |
| 입력 | `{ people, label, previous }` |
| 출력 | 질문 한 문장 (따옴표 없이, 160자에서 잘림) |
| 프롬프트 | 명세서 「아이스브레이커」, 빠른 모델, 캐시 없음 |
| 실패 시 | `lib/catalog.ts`의 활동별 질문 목록에서 다음 질문 |

첫 질문은 Claude 없이 질문 목록에서 바로 보여줘요(명세서대로).

---

## B. 매칭 규칙 맞추기 (예린님 코드)

명세서와 지금 동작이 다른 곳이에요. 위에서부터 중요한 순서예요.

### B-1. 그날 플랜이 있으면 하루 종일 제외 → 겹치는 시간만 제외 ⭐ 데모 전

- **지금**: `app/api/open-rooms/route.ts`의 `studentsWithRoomsOn`(76행, 85행 `!busy.has(...)`)이 그날 방이 하나라도 있는 학생을 통째로 빼요.
- **문제**: 점심 방이 해산돼도, 저녁 초대가 하나 남아 있으면 재매칭이 안 돼요. 방이 열린 뒤 다시 매칭해도 새 플랜이 안 생겨요. 데모 시나리오 8번(취소 → 해산 → 재매칭)이 막혀요.
- **바꿀 것**: 이 제외를 **없애면 돼요.** 이미 잡힌 약속과 취소한 시간은 제 스냅샷이 바쁜 시간으로 빼고 나서 넘기거든요. 그래서 같은 사람이 같은 시간에 두 방에 들어가는 일은 생기지 않아요. 지우기가 걱정되면 `skipBusyStudents: false` 같은 옵션도 괜찮아요.

### B-2. 시작 시각 후보: 지금+30분 → 지금+5분, 그리고 수업 끝나는 시각

- **지금**: `matching.ts` 48·69행. `LEAD_MINUTES = 30`이고 :00/:30에만 시작해서, 10:45에 끝나는 수업이면 11:00부터예요.
- **명세서**: 지금+5분 이후의 :00/:30, 그리고 오늘 내 수업이 끝나는 시각(10:45)에 시작.
- **바꿀 것 제안**: `LEAD_MINUTES`를 5로 줄이고, 108행 시작 시각 루프에 **각 슬롯의 `start`도 후보로 추가**해 주세요. 제 스냅샷은 수업이 끝나는 시각부터 free 슬롯을 만들어서, 슬롯 시작이 곧 수업 종료 시각이에요.
- 참고: "시작까지 최소 여유 5분 vs 30분"은 명세서에서 아직 정할 것으로 남아 있어요. 팀이 정하면 숫자만 바꾸면 돼요.

### B-3. 약속 길이 60~120분 → 60분 고정

- `matching.ts` 47행 `MAX_MINUTES = 120` → `60`.

### B-4. 방 최대 6명 고정 → 활동별 최대

- **지금**: `MAX_PEOPLE = 6`(45행, 118행). 축구·농구(최대 10명)도 6명에서 잘려요.
- **바꿀 것 제안**: `openRooms` 입력에 `maxPeople?: Record<string, number>`를 추가해 주세요. open-rooms 라우트에서는 `activities` 테이블의 `name → max_size`를 읽어서 넘기면 돼요. 6명보다 적은 쪽은 제 후처리가 이미 잘라요.

### B-5. 한 학생에게 최대 3개 · 다른 활동 먼저 · 시간대 점수

- **지금**: 전교생 기준으로 사람이 많은 방부터 확정해요(137행 `while (true)`). 시간대 점수가 없고, 한 학생이 받는 개수에도 제한이 없어요.
- **명세서**: 점수 = 팀 크기 / 최대 인원 + 같은 키워드 후보 수 × 0.01 + 시간대 적합도 + (수업 직후면 0.15). 높은 순으로, 서로 안 겹치게, 다른 활동부터, 학생당 최대 3개.
  - 시간대 적합도: Food 11:30~14:00·17:30~20:30 +0.5 / Cafe 13:30~17:30 +0.35, 10:00~13:30 +0.15 / Sports 15:00~20:00 +0.3 / Study 9:00~12:00·19:00~23:00 +0.25, 그 외 +0.1 / Culture 17:00~23:00 +0.3 / Games 16:00~23:00 +0.25
- **바꿀 것 제안**: 137행 루프에서 고르는 기준(`members.length`가 큰 것)을 위 점수로 바꾸고, 학생별 확정 개수가 3이 되면 그 학생을 후보에서 빼 주세요. 카테고리는 `activities.category`에 있어요. "수업 직후"는 B-2처럼 슬롯 시작 시각에 시작하는 방이면 돼요.

### B-6. (팀 결정 필요) 매칭 단위: 같은 활동 / 같은 카테고리

명세서에서 아직 정할 것으로 남아 있어요. 지금은 같은 활동만 묶어요(MVP 방식). boba와 coffee를 한 팀으로 묶기로 하면 ① 이름 정리 단계나 `openRooms`의 묶는 키를 카테고리로 바꿔야 해요.

---

## 확인 방법

```sh
npx tsx lib/nado/matching.test.ts      # 예린님 테스트 (규칙을 바꾸면 기대값도 같이 수정)
npx tsx lib/match/rules.test.ts        # 제 쪽 규칙 (최소/최대 인원, 스냅샷, 방 열림·해산)
npm run typecheck && npm run lint && npm run build
npm run dev                            # 로그인 → Profile에서 관심사 고르기 → Matches의 "Check again now"
# 데모 시계를 월 11:50으로 (두 폰 공통):
curl -X PUT localhost:3000/api/demo/clock -H 'Content-Type: application/json' -d '{"preset":"mon1150"}'
```

AI 함수만 따로 시험하려면 기존 `lib/nado/try-claude.ts`처럼 스크립트를 하나 만들어서 `npx tsx --env-file=.env.local`로 돌리면 돼요.

궁금한 점은 다솔에게 물어봐 주세요. 관련 코드: `lib/ai.ts`, `lib/match/`, `app/api/activities/`, `app/api/schedule/read/`.

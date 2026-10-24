# lib/nado: 방 열기 로직

Next.js 프로젝트의 `lib/nado/` 폴더에 그대로 넣으면 돼.

| 파일 | 하는 일 |
|---|---|
| `matching.ts` | ② 시간 계산 (코드만, Claude 없음): 같은 활동 + 겹치는 시간 → 방, 멤버, 장소, 색 |
| `prompts.ts` | ① 활동 이름 정리 프롬프트, ③ 초대 문구 + 아이스브레이커 프롬프트 |
| `claude.ts` | ① → ② → ③ 한 번에: `openRoomsWithClaude({ slots, places, now, presets })` |
| `sample-data.ts` | seed.sql이랑 같은 테스트 데이터 (이름 대신 익명 ID `s_01`...) |
| `matching.test.ts` | 계산 테스트 7개 |
| `try-claude.ts` | 진짜 Claude로 ①②③ 전체 돌려보기 (API 키 필요) |

## 설치

```bash
npm install @anthropic-ai/sdk
npm install -D tsx
```

`.env.local`에 `ANTHROPIC_API_KEY=...` 추가 (서버에서만 쓰니까 `NEXT_PUBLIC_` 붙이면 안 됨)

키가 workspace에 묶이지 않은 개인 키면 `ANTHROPIC_WORKSPACE_ID=wrkspc_...`도 추가 (없으면 400 에러)

## 테스트

```bash
npx tsx lib/nado/matching.test.ts                       # 계산만 (키 필요 없음)
npx tsx --env-file=.env.local lib/nado/try-claude.ts    # 진짜 Claude로 전체
```

## API에서 쓰는 법 (예: `app/api/open-rooms/route.ts`)

1. Supabase에서 `activity_slots`, `places` 읽기
2. `Slot` 모양으로 바꾸기: `{ studentId, activity, day: day_of_week, start: "HH:MM", end: "HH:MM" }`
   (`start_time`이 `"21:00:00"`으로 오면 앞 5글자만)
3. `now`: 캠퍼스 현지 시간(America/Los_Angeles) 기준 `{ day: 0~6, time: "HH:MM" }`
4. `await openRoomsWithClaude({ slots, places, now, presets: ["boba", "basketball", ...] })`
5. 결과 `rooms`마다:
   - `rooms` 테이블에 insert (`starts_at` = 오늘 날짜 + `start`, `place_id`는 이름으로 찾기)
   - `members`마다 `room_members`에 `status: 'invited'`로 insert
   - 나중에 첫 사람이 nado! 누르면 `icebreaker`를 `messages`에 Claude 메시지(`student_id` null)로 insert

Claude에게는 학생 이름도 ID도 안 넘어가. 활동 이름이랑 방 정보(활동, 시간, 장소, 인원수)만 가.
Claude 호출이 실패해도 원래 활동 이름 + 기본 문구로 계속 진행해서 데모가 안 멈춰.

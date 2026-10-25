# POST /api/open-rooms

Called by the demo's "Let Claude open rooms" button.

1. Reads that date's `activity_slots` and `places` from Supabase. If a student
   saved times for that week (`week_start`), those replace their every-week times.
2. Runs `openRoomsWithClaude` from lib/nado/ (Claude → code → Claude)
3. Inserts each room into `rooms` and its members into `room_members` (`invited`),
   which shows the invitation card on those phones through Supabase Realtime

Students already in a room that date are skipped, so pressing the button twice is safe
(and a judge who paints new times can press it again to get their own room).

```ts
const res = await fetch("/api/open-rooms", { method: "POST" });
const { opened, skipped, filtered } = await res.json();
```

Rehearse tomorrow's demo tonight by sending a fake campus date and time:

```ts
fetch("/api/open-rooms", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ now: { date: "2026-10-25", time: "10:30" } }),
  // or { now: { day: 0, time: "10:30" } } for the next Sunday (0 = Sunday)
});
```

Add `replace: true` to delete that date's rooms (and their joins and replies) and start over.

- Room-opening logic: lib/nado/
- Read ANTHROPIC_API_KEY only on the server; never prefix it with NEXT_PUBLIC_.
- Send Claude only activity names and room information, never student names or IDs.

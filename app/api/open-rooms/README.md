# POST /api/open-rooms

Called by the demo's "Let Claude open rooms" button.

1. Reads the day's `activity_slots` and `places` from Supabase
2. Runs `openRoomsWithClaude` from lib/nado/ (Claude → code → Claude)
3. Inserts each room into `rooms` and its members into `room_members` (`invited`),
   which shows the invitation card on those phones through Supabase Realtime

Students already in a room that day are skipped, so pressing the button twice is safe.

```ts
const res = await fetch("/api/open-rooms", { method: "POST" });
const { opened, skipped, filtered } = await res.json();
```

Rehearse tomorrow's demo tonight by sending a fake campus time (0 = Sunday):

```ts
fetch("/api/open-rooms", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ now: { day: 0, time: "10:30" } }),
});
```

- Room-opening logic: lib/nado/
- Read ANTHROPIC_API_KEY only on the server; never prefix it with NEXT_PUBLIC_.
- Send Claude only activity names and room information, never student names or IDs.

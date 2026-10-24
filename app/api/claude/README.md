# POST /api/claude

Called by the demo's "Let Claude open rooms" button. route.ts returns HTTP 501
until it is connected to lib/nado/.

- Room-opening logic: lib/nado/
- Read ANTHROPIC_API_KEY only on the server; never prefix it with NEXT_PUBLIC_.
- Send Claude only activity names and room information, never student names or IDs.

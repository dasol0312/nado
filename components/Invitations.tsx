"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCampusTime } from "@/lib/time";

type Invite = {
  id: string;
  activity: string;
  starts_at: string;
  invitation: string | null;
  color: string;
  status: string;
  place: string | null;
  myStatus: string;
  invited: number;
  joined: number;
};

// Invitations Claude sent this student, live. Reports how many still need an answer.
export default function Invitations({
  studentId,
  onPendingChange,
}: {
  studentId: string;
  onPendingChange?: (count: number) => void;
}) {
  const sb = useMemo(() => createClient(), []);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const mine = await sb.from("room_members").select("room_id, status").eq("student_id", studentId);
    if (mine.error) return setError(mine.error.message);
    const ids = mine.data.map((m) => m.room_id);
    if (!ids.length) return setInvites([]);

    const [roomsRes, membersRes] = await Promise.all([
      sb.from("rooms").select("id, activity, starts_at, invitation, color, status, places(name)").in("id", ids).neq("status", "cancelled").order("starts_at"),
      sb.from("room_members").select("room_id, status").in("room_id", ids),
    ]);
    if (roomsRes.error || membersRes.error) return setError((roomsRes.error ?? membersRes.error)!.message);

    const myStatus = new Map(mine.data.map((m) => [m.room_id, m.status as string]));
    const rows = roomsRes.data as unknown as (Omit<Invite, "place" | "myStatus" | "invited" | "joined"> & {
      places: { name: string } | null;
    })[];
    setError(null);
    setInvites(
      rows.map((r) => {
        const members = membersRes.data.filter((m) => m.room_id === r.id);
        return {
          ...r,
          place: r.places?.name ?? null,
          myStatus: myStatus.get(r.id) ?? "invited",
          invited: members.length,
          joined: members.filter((m) => m.status === "joined").length,
        };
      }),
    );
  }, [sb, studentId]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const channel = sb
      .channel(`invites-${studentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => load())
      .subscribe();
    return () => {
      clearTimeout(first);
      sb.removeChannel(channel);
    };
  }, [sb, studentId, load]);

  async function respond(roomId: string, action: "join" | "decline") {
    setBusy(roomId);
    try {
      const res = await fetch(`/api/rooms/${roomId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      if (!res.ok) setError((await res.json()).message ?? "Something went wrong.");
      await load();
    } finally {
      setBusy(null);
    }
  }

  const visible = invites.filter((i) => i.myStatus !== "declined");
  const pending = visible.filter((i) => i.myStatus === "invited").length;
  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm opacity-70">Claude opens rooms on its own. Nobody had to ask first.</p>
      {error && <p className="text-sm text-[#b4532a]">{error}</p>}
      {!visible.length && <p className="text-sm opacity-70">No invitations yet. They show up here the moment Claude opens a room for you.</p>}
      {visible.map((r) => (
        <article key={r.id} className="overflow-hidden rounded-2xl border border-[#c8d1c9] bg-white">
          <div className="h-2" style={{ background: r.color }} />
          <div className="flex flex-col gap-2 p-4">
            <p className="text-sm opacity-70">
              {r.activity} · {formatCampusTime(r.starts_at)} · {r.place ?? "TBD"} · {r.invited} students free
            </p>
            <p className="text-lg font-semibold">{r.invitation ?? `${r.activity}, anyone?`}</p>
            {r.myStatus === "joined" ? (
              <Link
                href={`/rooms/${r.id}`}
                className="self-start rounded-xl bg-[#203e35] px-4 py-2 font-semibold text-white"
              >
                Open room · {r.joined} in →
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  className="rounded-xl bg-[#e77747] px-5 py-2 text-lg font-bold text-white disabled:opacity-50"
                  disabled={busy === r.id}
                  onClick={() => respond(r.id, "join")}
                >
                  nado!
                </button>
                <button className="text-sm underline opacity-70" disabled={busy === r.id} onClick={() => respond(r.id, "decline")}>
                  Not this time
                </button>
              </div>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}

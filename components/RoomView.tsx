"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { QUICK_REPLIES, type QuickReply } from "@/lib/quick-replies";
import { createClient } from "@/lib/supabase/client";
import { formatCampusTime } from "@/lib/time";
import ColorMatch from "./ColorMatch";
import { useStudent } from "./useStudent";

type Room = {
  id: string;
  activity: string;
  starts_at: string;
  invitation: string | null;
  icebreaker: string | null;
  color: string;
  status: string;
  places: { name: string } | null;
};
type Member = { student_id: string; status: string; students: { name: string } | null };
type Message = { id: string; student_id: string | null; content: string; created_at: string };

export default function RoomView({ roomId }: { roomId: string }) {
  const sb = useMemo(() => createClient(), []);
  const [studentId] = useStudent();
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [meeting, setMeeting] = useState(false);
  const channel = useRef<RealtimeChannel | null>(null);

  const load = useCallback(async () => {
    const [roomRes, membersRes, messagesRes] = await Promise.all([
      sb.from("rooms").select("id, activity, starts_at, invitation, icebreaker, color, status, places(name)").eq("id", roomId).maybeSingle(),
      sb.from("room_members").select("student_id, status, students(name)").eq("room_id", roomId),
      sb.from("messages").select("id, student_id, content, created_at").eq("room_id", roomId).order("created_at"),
    ]);
    const err = roomRes.error ?? membersRes.error ?? messagesRes.error;
    if (err) setError(err.message);
    else {
      setError(null);
      setRoom(roomRes.data as unknown as Room | null);
      setMembers(membersRes.data as unknown as Member[]);
      setMessages(messagesRes.data as Message[]);
    }
    setLoaded(true);
  }, [sb, roomId]);

  // Live: joins, replies, and the "Time to meet!" signal
  useEffect(() => {
    const first = setTimeout(load, 0);
    const ch = sb
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, () => load())
      .on("broadcast", { event: "meet" }, () => setMeeting(true))
      .subscribe();
    channel.current = ch;
    return () => {
      clearTimeout(first);
      channel.current = null;
      sb.removeChannel(ch);
    };
  }, [sb, roomId, load]);

  async function post(path: string, body: object) {
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, ...body }),
      });
      if (!res.ok) setError((await res.json()).message ?? "Something went wrong.");
      await load();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  function timeToMeet() {
    setMeeting(true);
    channel.current?.send({ type: "broadcast", event: "meet", payload: {} });
  }

  if (!loaded) return <Shell>Loading room…</Shell>;
  if (!room) return <Shell>{error ?? "This room doesn't exist anymore."}</Shell>;

  const me = members.find((m) => m.student_id === studentId);
  const names = new Map(members.map((m) => [m.student_id, m.students?.name ?? "Someone"]));
  const joined = members.filter((m) => m.status === "joined");
  const latestReply = new Map<string, string>();
  for (const m of messages) if (m.student_id) latestReply.set(m.student_id, m.content);
  const place = room.places?.name ?? "the meeting spot";
  const time = formatCampusTime(room.starts_at);

  return (
    <Shell>
      {meeting && (
        <ColorMatch
          color={room.color}
          place={place}
          time={time}
          icebreaker={room.icebreaker}
          onClose={() => setMeeting(false)}
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-[#c8d1c9] bg-white">
        <div className="h-3" style={{ background: room.color }} />
        <div className="flex flex-col gap-1 p-4">
          <p className="text-sm font-semibold uppercase tracking-wide opacity-70">
            {room.activity}
            {room.status === "confirmed" ? " · confirmed" : ""}
          </p>
          <h1 className="text-2xl font-bold">{room.invitation ?? room.activity}</h1>
          <p>
            {time} · {place}
          </p>
        </div>
      </div>

      {!me && <p className="text-sm">You weren&apos;t invited to this room. Pick the right demo student on the home page.</p>}

      {me && me.status !== "joined" && (
        <div className="flex flex-col gap-2 rounded-2xl border border-[#c8d1c9] bg-white p-4">
          <p>{me.status === "declined" ? "You passed on this one. Changed your mind?" : "Say nado to see the room."}</p>
          <button
            className="self-start rounded-xl bg-[#e77747] px-5 py-2 text-lg font-bold text-white disabled:opacity-50"
            disabled={busy}
            onClick={() => post("join", {})}
          >
            nado!
          </button>
        </div>
      )}

      {me?.status === "joined" && (
        <>
          <section className="flex flex-col gap-2">
            {messages.map((m) =>
              m.student_id === null ? (
                <div key={m.id} className="rounded-2xl bg-[#203e35] p-3 text-white">
                  <p className="text-xs font-bold tracking-wide opacity-70">nado (Claude)</p>
                  <p>
                    {time} at {place}. {m.content}
                  </p>
                </div>
              ) : (
                <p key={m.id} className="self-start rounded-2xl bg-white px-3 py-2 text-sm">
                  <span className="font-semibold">{m.student_id === studentId ? "You" : names.get(m.student_id)}</span>: {m.content}
                </p>
              ),
            )}
          </section>

          <section className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Quick replies</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(QUICK_REPLIES) as QuickReply[]).map((key) => (
                <button
                  key={key}
                  className="rounded-full border border-[#203e35] bg-white px-4 py-2 font-semibold disabled:opacity-50"
                  disabled={busy}
                  onClick={() => post("reply", { reply: key })}
                >
                  {QUICK_REPLIES[key]}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#c8d1c9] bg-white p-4">
            <p className="mb-2 text-sm font-semibold">In the room ({joined.length})</p>
            <ul className="flex flex-col gap-1 text-sm">
              {joined.map((m) => (
                <li key={m.student_id} className="flex justify-between gap-2">
                  <span>
                    {m.students?.name ?? "Someone"}
                    {m.student_id === studentId ? " (you)" : ""}
                  </span>
                  <span className="opacity-70">{latestReply.get(m.student_id) ?? ""}</span>
                </li>
              ))}
            </ul>
          </section>

          <button
            className="rounded-xl px-4 py-3 text-lg font-bold text-white"
            style={{ background: room.color }}
            onClick={timeToMeet}
          >
            Time to meet!
          </button>
        </>
      )}

      {error && <p className="text-sm text-[#b4532a]">{error}</p>}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Link href="/" className="text-sm underline">
        ← nado
      </Link>
      {children}
    </div>
  );
}

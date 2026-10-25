"use client";

// The only things you can say in a room: three fixed replies, live for everyone (no free-text chat)
import { useCallback, useEffect, useMemo, useState } from "react";
import { QUICK_REPLIES, type QuickReply } from "@/lib/quick-replies";
import { createClient } from "@/lib/supabase/client";
import { formatMinutes, campusClock } from "@/lib/time";
import { useApp, type Member } from "../shell/AppProvider";

type Message = { id: string; student_id: string | null; content: string; created_at: string };

export default function QuickReplies({ roomId, members }: { roomId: string; members: Member[] }) {
  const { act, toast } = useApp();
  const sb = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await sb.from("messages").select("id, student_id, content, created_at").eq("room_id", roomId)
      .order("created_at", { ascending: false }).limit(6);
    if (data) setMessages([...data].reverse()); // newest 6, shown oldest first
  }, [sb, roomId]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const ch = sb
      .channel(`messages-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` }, () => load())
      .subscribe();
    return () => {
      clearTimeout(first);
      sb.removeChannel(ch);
    };
  }, [sb, roomId, load]);

  async function send(reply: QuickReply) {
    setBusy(true);
    try {
      await act(`/api/rooms/${roomId}/reply`, { reply });
      await load();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const who = (id: string | null) => {
    if (!id) return "Nado";
    const m = members.find((x) => x.id === id);
    return m?.isMe ? "You" : m?.nickname ?? "Someone";
  };

  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="between"><h3>Quick replies</h3><span className="small muted">No chat, just these</span></div>
      {messages.length > 0 && (
        <div className="stack" style={{ gap: 4 }}>
          {messages.slice(-6).map((m) => (
            <div key={m.id} className="between small">
              <span><b>{who(m.student_id)}</b> {m.content}</span>
              <span className="mono muted">{formatMinutes(campusClock(new Date(m.created_at)).minutes)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="row">
        {(Object.keys(QUICK_REPLIES) as QuickReply[]).map((k) => (
          <button key={k} className="btn soft sm" disabled={busy} onClick={() => send(k)}>{QUICK_REPLIES[k]}</button>
        ))}
      </div>
    </div>
  );
}

// Nicknames only: nobody sees anyone's profile
import type { Member } from "../shell/AppProvider";

const COLORS = ["#7a3fb8", "#c2541a", "#1b7a51", "#2f6fd6", "#b0372b", "#8a6d00", "#0f7c84", "#a3367a"];
const colorOf = (id: string) => COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

export default function MemberChips({ members }: { members: Member[] }) {
  return (
    <div className="members">
      {members.map((m) =>
        m.isMe ? (
          <span key={m.id} className="mem me"><i style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>Me</i>{m.nickname}</span>
        ) : (
          <span key={m.id} className="mem"><i style={{ background: colorOf(m.id) }}>{m.nickname[0]}</i>{m.nickname}</span>
        ),
      )}
    </div>
  );
}

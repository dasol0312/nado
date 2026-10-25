"use client";

// Full-screen bright yellow so the group can spot this phone
export default function GlowScreen({ nickname, foundBy, onMet }: { nickname: string; foundBy: string; onMet: () => void }) {
  return (
    <div className="glow" role="alert">
      <div className="big">I’m here!</div>
      <div className="nick">{nickname}</div>
      <p>Your group is looking for this screen.<br />Hold your phone up high.</p>
      {foundBy && (
        <>
          <div className="found">{foundBy} found you!</div>
          <button className="btn" onClick={onMet}>We met</button>
        </>
      )}
    </div>
  );
}

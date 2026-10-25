// Sketch map of Washington Square: meet pin, dashed walk to the activity spot, other spots faded.
import { PLACES, type PlaceInfo } from "@/lib/places";

export default function CampusMap({ meet, dest }: { meet: PlaceInfo; dest?: PlaceInfo }) {
  const m = meet;
  const d = dest ?? m;
  const same = m.key === d.key;
  const lw = Math.min(190, m.name.length * 5.6 + 22);
  const lx = Math.max(6, Math.min(354 - lw, m.x - lw / 2));
  const ly = Math.max(4, m.y - 52);
  return (
    <svg className="map" viewBox="0 0 360 262" role="img" aria-label={`Sketch map of Washington Square. Meet at ${m.name}${same ? "" : `, then walk to ${d.name}`}`}>
      <rect width="360" height="262" fill="var(--map-bg)" />
      <g stroke="var(--map-street)" strokeWidth="9" strokeLinecap="square">
        <path d="M0 24H360M0 60H360M0 190H360M0 222H360" />
        <path d="M96 0V262M168 0V62M240 0V262M156 190V262M296 0V262M336 0V262" />
      </g>
      <rect x="104" y="68" width="128" height="114" rx="4" fill="var(--map-park)" />
      <path d="M108 72L228 178M228 72L108 178M168 72V178M108 126H228" stroke="var(--map-path)" strokeWidth="3" fill="none" />
      <circle cx="168" cy="126" r="11" fill="var(--map-path)" />
      <rect x="161" y="64" width="14" height="10" rx="2" fill="var(--map-bldg)" />
      <g fill="var(--map-campus)">
        <rect x="164" y="196" width="40" height="18" rx="2" /><rect x="208" y="196" width="28" height="18" rx="2" />
        <rect x="246" y="96" width="44" height="32" rx="2" /><rect x="280" y="226" width="44" height="22" rx="2" />
      </g>
      <g fontSize="7.5" fill="var(--muted)" fontFamily="var(--f-mono)">
        <text x="4" y="20">W 8th St</text><text x="4" y="56">Waverly Pl</text><text x="4" y="186">W 4th St</text><text x="4" y="218">W 3rd St</text>
        <text x="171" y="10">5th Ave</text><text x="243" y="10">University Pl</text><text x="300" y="160">Mercer</text>
      </g>
      {PLACES.filter((p) => ![m, d].some((x) => x.key === p.key || x.name.toLowerCase() === p.name.toLowerCase())).map((p) => {
        const right = p.side !== "l";
        return (
          <g key={p.key}>
            <circle cx={p.x} cy={p.y} r="3" fill={p.campus ? "var(--accent)" : "var(--muted)"} opacity=".55" />
            <text x={right ? p.x + 6 : p.x - 6} y={p.y + 3.5} fontSize="8" fill="var(--muted)" textAnchor={right ? "start" : "end"}>{p.tag}</text>
          </g>
        );
      })}
      {!same && (
        <>
          <path d={`M${m.x} ${m.y}L${d.x} ${d.y}`} stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 4" fill="none" />
          <circle cx={d.x} cy={d.y} r="7" fill="var(--card)" stroke="var(--accent)" strokeWidth="3" />
          <text x={d.side !== "l" ? d.x + 11 : d.x - 11} y={d.y + 3.5} fontSize="9" fontWeight="600" fill="var(--ink)" textAnchor={d.side !== "l" ? "start" : "end"}>{d.tag}</text>
        </>
      )}
      <path d={`M${m.x} ${m.y}c-6-9-10-13-10-18a10 10 0 1 1 20 0c0 5-4 9-10 18z`} fill="var(--accent)" />
      <circle cx={m.x} cy={m.y - 18} r="4" fill="var(--card)" />
      <rect x={lx} y={ly} width={lw} height="20" rx="10" fill="var(--card)" stroke="var(--accent)" />
      <text x={lx + lw / 2} y={ly + 13.5} fontSize="9.5" fontWeight="600" fill="var(--ink)" textAnchor="middle">Meet: {m.name}</text>
      <text x="356" y="258" fontSize="7" fill="var(--muted)" textAnchor="end">Sketch · not to scale · purple = NYU</text>
    </svg>
  );
}

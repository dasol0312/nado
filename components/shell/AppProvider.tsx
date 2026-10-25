"use client";

// App-wide client state: who's signed in, the shared demo clock, my plans (live through
// Supabase Realtime), my profile, the activity catalog, push banners and toasts.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { clockNow, type ClockRow } from "@/lib/clock";
import { createClient } from "@/lib/supabase/client";
import { HORIZON_MINUTES } from "@/lib/time";
import type { Activity, BusyKind, MemberStatus, Outfit, RoomStatus } from "@/types/database";

export type Me = { id: string; nickname: string; email: string | null };
export type PlaceRow = {
  key: string; name: string; address: string | null; is_campus: boolean | null;
  ns_street: string | null; ew_street: string | null; far: string | null; confident: boolean | null; // set for places Claude suggested
};
export type Member = { id: string; nickname: string; status: MemberStatus; outfit: Outfit | null; isSample: boolean; isMe: boolean };
export type Plan = {
  id: string;
  activity: string;
  startsAt: number;
  endsAt: number;
  status: RoomStatus;
  myStatus: MemberStatus;
  minSize: number;
  maxSize: number;
  confirmBy: number | null;
  invitation: string | null;
  icebreaker: string | null;
  placeReason: string | null;
  meet: PlaceRow | null;
  dest: PlaceRow | null;
  members: Member[]; // everyone still in (not cancelled/declined), me included
};
export type ActivityRow = Pick<Activity, "name" | "label" | "category" | "max_size" | "min_default" | "reason" | "by_ai"> & {
  meet: PlaceRow | null;
  dest: PlaceRow | null;
};
export type BlockRow = { kind: BusyKind; day: number; start: string; end: string; label: string | null };
export type Profile = { blocks: BlockRow[]; interests: { activity: string; min: number }[] };
type Banner = { plan: Plan; title: string; key: number } | null;

type Ctx = {
  me: Me | null;
  now: Date; // re-rendered every 20 s
  getNow: () => Date;
  clock: ClockRow | null;
  plans: Plan[];
  plansReady: boolean;
  activities: ActivityRow[];
  profile: Profile | null;
  reloadPlans: (title?: string) => Promise<string[]>;
  reloadProfile: () => Promise<void>;
  reloadActivities: () => Promise<void>;
  matching: boolean;
  runMatch: (opts?: { title?: string; quietIfNone?: boolean }) => Promise<void>;
  banner: Banner;
  showBanner: (plan: Plan, title: string) => void;
  hideBanner: () => void;
  toastMsg: string | null;
  popping: boolean;
  pop: () => void;
  toast: (msg: string) => void;
  notifOn: boolean;
  setNotifOn: (v: boolean) => void;
  act: (path: string, body?: unknown, method?: string) => Promise<Record<string, unknown>>;
};

const AppContext = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppContext);
  if (!c) throw new Error("useApp must be inside AppProvider");
  return c;
};

const PLAN_SELECT =
  "status, rooms!inner(id, activity, starts_at, ends_at, status, min_size, max_size, confirm_by, invitation, icebreaker, place_reason," +
  " meet:places!rooms_place_id_fkey(key, name, address, is_campus, ns_street, ew_street, far, confident), dest:places!rooms_dest_place_id_fkey(key, name, address, is_campus, ns_street, ew_street, far, confident)," +
  " room_members(student_id, status, outfit, students(nickname, is_sample)))";
type RawPlan = {
  status: MemberStatus;
  rooms: {
    id: string; activity: string; starts_at: string; ends_at: string | null; status: RoomStatus; min_size: number; max_size: number;
    confirm_by: string | null; invitation: string | null; icebreaker: string | null; place_reason: string | null;
    meet: PlaceRow | null; dest: PlaceRow | null;
    room_members: { student_id: string; status: MemberStatus; outfit: Outfit | null; students: { nickname: string; is_sample: boolean } | null }[];
  };
};

const readLocal = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
};
const writeLocal = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
};

export default function AppProvider({ me, children }: { me: Me | null; children: React.ReactNode }) {
  const sb = useMemo(() => createClient(), []);
  const [clock, setClock] = useState<ClockRow | null>(null);
  const clockRef = useRef<ClockRow | null>(null);
  const getNow = useCallback(() => clockNow(clockRef.current), []);
  const [now, setNow] = useState(() => new Date());
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansReady, setPlansReady] = useState(false);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matching, setMatching] = useState(false);
  const matchingRef = useRef(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [popping, setPopping] = useState(false);
  const popTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pop = useCallback(() => {
    setPopping(true);
    clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setPopping(false), 1100);
  }, []);
  const [notifOn, setNotifOnState] = useState(true);
  const seen = useRef<Set<string> | null>(null);
  const notifRef = useRef(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setNotifOnState(readLocal("nado:notif", true));
      notifRef.current = readLocal("nado:notif", true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);
  const bannerTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideBanner = useCallback(() => setBanner(null), []);
  const showBanner = useCallback((plan: Plan, title: string) => {
    if (!notifRef.current) return;
    setBanner({ plan, title, key: Date.now() });
    clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 7000);
  }, []);
  const setNotifOn = useCallback((v: boolean) => {
    notifRef.current = v;
    setNotifOnState(v);
    writeLocal("nado:notif", v);
    if (!v) setBanner(null);
  }, []);

  // Demo clock
  const applyClock = useCallback((row: ClockRow | null) => {
    clockRef.current = row;
    setClock(row);
    setNow(clockNow(row));
  }, []);
  useEffect(() => {
    sb.from("app_clock").select("base, set_at, label").eq("id", 1).maybeSingle().then(({ data }) => applyClock(data as ClockRow | null));
    const t = setInterval(() => setNow(clockNow(clockRef.current)), 20_000);
    return () => clearInterval(t);
  }, [sb, applyClock]);

  const reloadActivities = useCallback(async () => {
    const { data } = await sb
      .from("activities")
      .select("name, label, category, max_size, min_default, reason, by_ai, meet:places!activities_meet_place_id_fkey(key, name, address, is_campus, ns_street, ew_street, far, confident), dest:places!activities_dest_place_id_fkey(key, name, address, is_campus, ns_street, ew_street, far, confident)")
      .order("created_at");
    if (data) setActivities(data as unknown as ActivityRow[]);
  }, [sb]);
  useEffect(() => {
    const t = setTimeout(reloadActivities, 0);
    return () => clearTimeout(t);
  }, [reloadActivities]);

  // A different student signed in (or out): start their state fresh
  const meId = me?.id ?? null;
  useEffect(() => {
    seen.current = null;
    const t = setTimeout(() => {
      setPlans([]);
      setPlansReady(false);
      setProfile(null);
      setBanner(null);
    }, 0);
    return () => clearTimeout(t);
  }, [meId]);

  const reloadProfile = useCallback(async () => {
    if (!me) return;
    const [b, i] = await Promise.all([
      sb.from("busy_blocks").select("kind, day_of_week, start_time, end_time, label").eq("student_id", me.id),
      sb.from("interests").select("activity, min_size").eq("student_id", me.id),
    ]);
    if (b.error || i.error) return;
    setProfile({
      blocks: b.data.map((x) => ({ kind: x.kind as BusyKind, day: x.day_of_week, start: x.start_time.slice(0, 5), end: x.end_time.slice(0, 5), label: x.label })),
      interests: i.data.map((x) => ({ activity: x.activity, min: x.min_size })),
    });
  }, [sb, me]);
  useEffect(() => {
    const t = setTimeout(reloadProfile, 0);
    return () => clearTimeout(t);
  }, [reloadProfile]);

  // My plans. Returns the ids of plans I'm newly invited to (and pushes the first one).
  const reloadPlans = useCallback(async (title = "A plan fits the next few hours") => {
    if (!me) return [];
    const { data, error } = await sb.from("room_members").select(PLAN_SELECT).eq("student_id", me.id);
    if (error) {
      console.error("[nado] loading plans failed:", error.message);
      return [];
    }
    const list: Plan[] = (data as unknown as RawPlan[]).map(({ status, rooms: r }) => {
      const startsAt = new Date(r.starts_at).getTime();
      return {
        id: r.id, activity: r.activity, startsAt, endsAt: r.ends_at ? new Date(r.ends_at).getTime() : startsAt + 3_600_000,
        status: r.status, myStatus: status, minSize: r.min_size, maxSize: r.max_size,
        confirmBy: r.confirm_by ? new Date(r.confirm_by).getTime() : null,
        invitation: r.invitation, icebreaker: r.icebreaker, placeReason: r.place_reason, meet: r.meet, dest: r.dest,
        members: r.room_members
          .filter((m) => m.status !== "cancelled" && m.status !== "declined")
          .map((m) => ({ id: m.student_id, nickname: m.students?.nickname ?? "Someone", status: m.status, outfit: m.outfit, isSample: !!m.students?.is_sample, isMe: m.student_id === me.id }))
          .sort((a, b) => Number(b.isMe) - Number(a.isMe) || a.nickname.localeCompare(b.nickname)),
      };
    }).sort((a, b) => a.startsAt - b.startsAt);
    setPlans(list);
    setPlansReady(true);

    const invites = list.filter((p) => p.status === "open" && p.myStatus === "invited");
    if (!seen.current) {
      seen.current = new Set(list.map((p) => p.id));
      return [];
    }
    const fresh = invites.filter((p) => !seen.current!.has(p.id));
    list.forEach((p) => seen.current!.add(p.id));
    if (fresh.length) showBanner(fresh[0], title);
    return fresh.map((p) => p.id);
  }, [sb, me, showBanner]);

  // Live updates: plans, groups, and the demo clock
  useEffect(() => {
    if (!me) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => reloadPlans(), 200);
    };
    const first = setTimeout(() => reloadPlans(), 0);
    const ch: RealtimeChannel = sb
      .channel(`app-${me.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members" }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_clock" }, (p) => applyClock(p.new as ClockRow))
      .subscribe();
    return () => {
      clearTimeout(first);
      clearTimeout(timer);
      sb.removeChannel(ch);
    };
  }, [sb, me, reloadPlans, applyClock]);

  const act = useCallback(async (path: string, body?: unknown, method = "POST") => {
    const res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message ?? "Something went wrong.");
    return json as Record<string, unknown>;
  }, []);

  const runMatch = useCallback(async (opts: { title?: string; quietIfNone?: boolean } = {}) => {
    if (!me || matchingRef.current) return;
    matchingRef.current = true;
    setMatching(true);
    try {
      // main's /api/match (lib/server/match.ts) returns the plans it opened, with their members
      const res = await act("/api/match", {});
      const opened = Array.isArray(res.rooms) ? (res.rooms as { members?: string[] }[]) : [];
      const mine = opened.filter((r) => r.members?.includes(me.id)).length;
      try {
        sessionStorage.setItem("nado:lastMatch", String(Date.now()));
      } catch {}
      const fresh = await reloadPlans(opts.title);
      // Realtime may have shown the banner already; `mine` says whether anything new is mine
      if (!fresh.length && !mine && !opts.quietIfNone) toast(`No new plans for the next ${HORIZON_MINUTES / 60} hours`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      matchingRef.current = false;
      setMatching(false);
    }
  }, [me, act, reloadPlans, toast]);

  const value: Ctx = {
    me, now, getNow, clock, plans, plansReady, activities, profile, reloadPlans, reloadProfile, reloadActivities,
    matching, runMatch, banner, showBanner, hideBanner, toastMsg, toast, popping, pop, notifOn, setNotifOn, act,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// A plan's group size counting everyone still in
export const planSize = (p: Plan) => p.members.length;
export const confirmedCount = (p: Plan) => p.members.filter((m) => m.status === "confirmed").length;

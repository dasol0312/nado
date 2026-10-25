// Row types matching supabase/schema.sql (v4.1).
// UUID, time, date and timestamptz values arrive as strings via Supabase.
export interface Student {
  id: string;
  email: string | null;
  is_judge: boolean;
  nickname: string;
  is_sample: boolean;
  created_at: string;
}

export interface Place {
  id: string;
  key: string;
  name: string;
  description: string | null;
  address: string | null;
  is_campus: boolean;
  ns_street: string | null;
  ew_street: string | null;
  far: "" | "N" | "S" | "E" | "W" | null;
  confident: boolean | null;
  good_for: string[];
}

export interface Activity {
  name: string;
  label: string;
  category: "Sports" | "Cafe" | "Study" | "Food" | "Culture" | "Games" | "Other";
  max_size: number;
  min_default: number;
  meet_place_id: string | null;
  dest_place_id: string | null;
  reason: string | null;
  by_ai: boolean;
  created_by: string | null;
  created_at: string;
}

export type BusyKind = "class" | "fixed" | "never";
export interface Interest {
  student_id: string;
  activity: string;
  min_size: number;
}

export type RoomStatus = "open" | "confirmed" | "cancelled";
export interface Room {
  id: string;
  activity: string;
  starts_at: string;
  ends_at: string | null;
  place_id: string | null;
  dest_place_id: string | null;
  place_reason: string | null;
  invitation: string | null;
  icebreaker: string | null;
  color: string;
  min_size: number;
  max_size: number;
  confirm_by: string | null;
  context_label: string | null;
  status: RoomStatus;
  created_at: string;
}

export type MemberStatus = "invited" | "joined" | "confirmed" | "cancelled" | "declined";
export interface Outfit {
  color: string;
  top: string;
  shoes: string;
  hair: string;
}
export interface Message {
  id: string;
  room_id: string;
  student_id: string | null;
  content: string;
  created_at: string;
}

// Row types based on the schema v3 shared by the team.
// UUID, time, and timestamptz values arrive as strings via Supabase.
export interface Student {
  id: string;
  name: string;
  is_sample: boolean;
  created_at: string;
}

export interface ActivitySlot {
  id: string;
  student_id: string;
  activity: string;
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  start_time: string;
  end_time: string;
  week_start: string | null; // Sunday of the week ("YYYY-MM-DD"); null = every week
}

export interface Place {
  id: string;
  name: string;
  description: string | null;
  good_for: string[];
}

export interface Room {
  id: string;
  activity: string;
  starts_at: string;
  place_id: string | null;
  invitation: string | null;
  icebreaker: string | null;
  color: string;
  status: "open" | "confirmed" | "cancelled";
  created_at: string;
}

export interface RoomMember {
  room_id: string;
  student_id: string;
  status: "invited" | "joined" | "declined";
  responded_at: string | null;
}

export interface Message {
  id: string;
  room_id: string;
  student_id: string | null;
  content: string;
  created_at: string;
}

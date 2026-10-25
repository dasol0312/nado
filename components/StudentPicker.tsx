"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// "Sign in" as a demo student. Not real authentication.
export default function StudentPicker({ studentId, onChange }: { studentId: string; onChange: (id: string) => void }) {
  const sb = useMemo(() => createClient(), []);
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sb.from("students")
      .select("id, name")
      .order("name")
      .then(({ data, error }) => {
        if (error) setError(`Could not load students: ${error.message}`);
        else setStudents(data ?? []);
      });
  }, [sb]);

  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      I am
      <select
        className="rounded-lg border border-[#c8d1c9] bg-white p-2 text-base font-normal"
        value={students.some((s) => s.id === studentId) ? studentId : ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Pick a demo student</option>
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {error && <span className="font-normal text-[#b4532a]">{error}</span>}
    </label>
  );
}

"use client";

import { useCallback, useSyncExternalStore } from "react";

// The demo student this browser is "signed in" as. Kept per browser so two
// phones (or two windows) can be different students.
const KEY = "nado:studentId";
const EVENT = "nado:student";

function read() {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useStudent(): [string, (id: string) => void] {
  const studentId = useSyncExternalStore(subscribe, read, () => "");
  const setStudentId = useCallback((id: string) => {
    try {
      localStorage.setItem(KEY, id);
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [studentId, setStudentId];
}

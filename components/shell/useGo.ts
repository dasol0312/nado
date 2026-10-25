"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

// Navigate and re-render server components, so the root layout sees a new or ended session
export function useGo() {
  const router = useRouter();
  return useCallback((path: string) => {
    router.push(path);
    router.refresh();
  }, [router]);
}

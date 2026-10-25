"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useApp } from "./AppProvider";

// "Nado!" on a plan: join, celebrate, go to Groups where the confirm step happens
export function useNado() {
  const { act, hideBanner, pop, toast, reloadPlans } = useApp();
  const router = useRouter();
  return useCallback(async (roomId: string) => {
    hideBanner();
    try {
      await act(`/api/rooms/${roomId}/join`);
      try {
        sessionStorage.setItem(`nado:joinedAt:${roomId}`, String(Date.now())); // Groups shows "forming" for 1.5 s
      } catch {}
      pop();
      toast("Added to your groups");
      await reloadPlans();
      router.push("/groups");
    } catch (e) {
      toast((e as Error).message);
    }
  }, [act, hideBanner, pop, toast, reloadPlans, router]);
}

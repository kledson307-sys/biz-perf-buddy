import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const ACCESS_UPDATED = "access-presence-updated";
export const PRESENCE_INTERVAL = 20 * 60_000;
const REQUEST_TIMEOUT = 12_000;

/** Presence is confirmed by the authenticated RPC, never by a local timestamp alone. */
export function useAccessPresence(enabled: boolean, onUse?: () => Promise<void>) {
  const [status, setStatus] = useState<"pending" | "confirmed" | "error">("pending");
  const [confirmedAt, setConfirmedAt] = useState<Date | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const callback = useRef(onUse);
  callback.current = onUse;
  const mounted = useRef(false);

  const register = useCallback(() => {
    if (!enabled || document.visibilityState !== "visible") return Promise.resolve();
    if (inFlight.current) return inFlight.current;
    const run = async () => {
      if (mounted.current) setStatus("pending");
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          Promise.resolve(supabase.rpc("registrar_acesso")),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error("Presence timeout")), REQUEST_TIMEOUT);
          }),
        ]);
        if (result.error) throw result.error;
        if (mounted.current) {
          setConfirmedAt(new Date());
          setStatus("confirmed");
          window.dispatchEvent(new Event(ACCESS_UPDATED));
        }
      } catch {
        if (mounted.current) setStatus("error");
      } finally {
        clearTimeout(timeout);
      }
      // A failed presence write must not prevent the consultant from seeing their work.
      if (mounted.current) await callback.current?.();
    };
    const task = run().finally(() => { inFlight.current = null; });
    inFlight.current = task;
    return task;
  }, [enabled]);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) return () => { mounted.current = false; };
    const refresh = () => { void register(); };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    const interval = window.setInterval(refresh, PRESENCE_INTERVAL);
    return () => {
      mounted.current = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(interval);
    };
  }, [enabled, register]);

  useEffect(() => {
    if (!enabled || status !== "error") return;
    const retry = window.setTimeout(() => { void register(); }, 10_000);
    return () => window.clearTimeout(retry);
  }, [enabled, status, register]);

  return { status, confirmedAt, register };
}
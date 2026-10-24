import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRESENCE_INTERVAL, useAccessPresence } from "@/hooks/use-access-presence";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

describe("Usage presence", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("records presence before reading consultant data and confirms only after success", async () => {
    let resolve: ((value: { error: null }) => void) | undefined;
    rpc.mockReturnValue(new Promise(r => { resolve = r; }));
    const load = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAccessPresence(true, load));
    expect(rpc).toHaveBeenCalledWith("registrar_acesso");
    expect(load).not.toHaveBeenCalled();
    expect(result.current.confirmedAt).toBeNull();
    await act(async () => { resolve?.({ error: null }); });
    expect(result.current.status).toBe("confirmed");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not mark a failed write as confirmed and permits retry without hiding data", async () => {
    rpc.mockResolvedValueOnce({ error: { message: "offline" } });
    const load = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAccessPresence(true, load));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.confirmedAt).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.register(); });
    expect(result.current.status).toBe("confirmed");
  });

  it("registers when returning to the app or reconnecting, never while hidden", async () => {
    const { result } = renderHook(() => useAccessPresence(true));
    await waitFor(() => expect(result.current.status).toBe("confirmed"));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(rpc).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    await act(async () => { window.dispatchEvent(new Event("online")); });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it("renews usage every 20 minutes", async () => {
    vi.useFakeTimers();
    renderHook(() => useAccessPresence(true));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(PRESENCE_INTERVAL); });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("never records a signed-out user", () => {
    renderHook(() => useAccessPresence(false));
    expect(rpc).not.toHaveBeenCalled();
  });
});
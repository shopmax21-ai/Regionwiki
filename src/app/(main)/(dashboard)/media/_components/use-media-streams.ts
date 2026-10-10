"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { MediaResponse } from "@/lib/media/types";

const REFRESH_MS = 60_000;

/**
 * Список трансляций с автообновлением раз в минуту. Пока вкладка скрыта, запросы не идут,
 * а при возвращении на вкладку список обновляется сразу.
 */
export function useMediaStreams() {
  const [data, setData] = useState<MediaResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  // fresh: обойти кэш браузера и CDN, например после правки списка каналов
  const load = useCallback(async (fresh = false) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setRefreshing(true);
    try {
      const response = await fetch(fresh ? `/api/media/streams?t=${Date.now()}` : "/api/media/streams", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setData((await response.json()) as MediaResponse);
      setFailed(false);
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      if (controllerRef.current === controller) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(refreshIfVisible, REFRESH_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      controllerRef.current?.abort();
    };
  }, [load]);

  const reload = useCallback(() => load(true), [load]);

  return { data, failed, refreshing, reload };
}

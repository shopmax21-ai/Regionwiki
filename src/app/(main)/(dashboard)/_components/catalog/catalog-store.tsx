"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { CatalogEntry, CatalogEntryDraft, CatalogKindOption } from "./catalog-types";
import { formatPrice, getInitials } from "./catalog-utils";

interface PersistedState {
  added: CatalogEntry[];
  removed: string[];
  starred: Record<string, boolean>;
}

interface CatalogStoreValue {
  entries: CatalogEntry[];
  kinds: CatalogKindOption[];
  defaultOwner: string;
  addEntry: (draft: CatalogEntryDraft) => void;
  toggleStar: (entryId: string) => void;
  removeEntry: (entryId: string) => void;
}

const CatalogStoreContext = createContext<CatalogStoreValue | null>(null);

function isEntry(value: unknown): value is CatalogEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === "string" && typeof entry.name === "string" && typeof entry.kind === "string";
}

function readPersisted(storageKey: string): Partial<PersistedState> {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedState>;

    return {
      added: Array.isArray(parsed.added) ? parsed.added.filter(isEntry) : [],
      removed: Array.isArray(parsed.removed) ? parsed.removed.filter((id) => typeof id === "string") : [],
      starred: parsed.starred && typeof parsed.starred === "object" ? parsed.starred : {},
    };
  } catch {
    return {};
  }
}

interface CatalogStoreProviderProps {
  storageKey: string;
  initialEntries: CatalogEntry[];
  kinds: CatalogKindOption[];
  defaultOwner: string;
  children: ReactNode;
}

export function CatalogStoreProvider({
  storageKey,
  initialEntries,
  kinds,
  defaultOwner,
  children,
}: CatalogStoreProviderProps) {
  const [added, setAdded] = useState<CatalogEntry[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [starred, setStarred] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = readPersisted(storageKey);
    setAdded(saved.added ?? []);
    setRemoved(saved.removed ?? []);
    setStarred(saved.starred ?? {});
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;

    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ added, removed, starred } satisfies PersistedState));
    } catch {
      // Хранилище недоступно (приватный режим, переполнение) — работаем только в памяти.
    }
  }, [added, removed, starred, hydrated, storageKey]);

  const entries = useMemo(
    () =>
      [...added, ...initialEntries]
        .filter((entry) => !removed.includes(entry.id))
        .map((entry) => (entry.id in starred ? { ...entry, starred: starred[entry.id] } : entry)),
    [added, initialEntries, removed, starred],
  );

  const addEntry = useCallback(
    (draft: CatalogEntryDraft) => {
      const owner = draft.owner.trim() || defaultOwner;
      const entry: CatalogEntry = {
        id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: draft.name.trim(),
        kind: draft.kind,
        price: formatPrice(draft.price),
        owner,
        ownerInitials: getInitials(owner),
        modifiedAt: "Только что",
        shared: draft.shared,
        starred: false,
        isNew: draft.isNew || undefined,
        details: draft.details,
      };

      setAdded((current) => [entry, ...current]);
    },
    [defaultOwner],
  );

  const toggleStar = useCallback(
    (entryId: string) => {
      const target = entries.find((entry) => entry.id === entryId);
      if (!target) return;

      setStarred((current) => ({ ...current, [entryId]: !target.starred }));
    },
    [entries],
  );

  const removeEntry = useCallback((entryId: string) => {
    setAdded((current) => current.filter((entry) => entry.id !== entryId));
    setRemoved((current) => (current.includes(entryId) ? current : [...current, entryId]));
    setStarred((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== entryId)));
  }, []);

  const value = useMemo(
    () => ({ entries, kinds, defaultOwner, addEntry, toggleStar, removeEntry }),
    [entries, kinds, defaultOwner, addEntry, toggleStar, removeEntry],
  );

  return <CatalogStoreContext.Provider value={value}>{children}</CatalogStoreContext.Provider>;
}

export function useCatalogStore() {
  const context = useContext(CatalogStoreContext);

  if (!context) {
    throw new Error("useCatalogStore должен использоваться внутри CatalogStoreProvider");
  }

  return context;
}

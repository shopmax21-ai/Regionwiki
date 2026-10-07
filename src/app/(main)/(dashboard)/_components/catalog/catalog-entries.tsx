"use client";

import { useMemo, useState } from "react";

import { PackageOpen } from "lucide-react";

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

import { CatalogDetailsDialog } from "./catalog-details-dialog";
import { CatalogGridView } from "./catalog-grid-view";
import { CatalogListView } from "./catalog-list-view";
import { useCatalogStore } from "./catalog-store";
import type { CatalogDetailSection, CatalogView, CatalogViewEntry } from "./catalog-types";

interface CatalogEntriesProps {
  view: CatalogView;
  ownerColumn: string;
  sharedLabel: string;
  sections: CatalogDetailSection[];
}

export function CatalogEntries({ view, ownerColumn, sharedLabel, sections }: CatalogEntriesProps) {
  const { entries, kinds, toggleStar, removeEntry } = useCatalogStore();
  const [openedId, setOpenedId] = useState<string | null>(null);

  const viewEntries = useMemo<CatalogViewEntry[]>(() => {
    const kindsByValue = new Map(kinds.map((kind) => [kind.value, kind]));

    return entries.map((entry) => {
      const kind = kindsByValue.get(entry.kind) ?? kinds[0];

      return { ...entry, kindLabel: kind?.label ?? "", icon: kind?.icon };
    });
  }, [entries, kinds]);

  const openedEntry = viewEntries.find((entry) => entry.id === openedId) ?? null;

  if (viewEntries.length === 0) {
    return (
      <Empty className="min-h-40">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageOpen />
          </EmptyMedia>
          <EmptyTitle>Список пуст</EmptyTitle>
          <EmptyDescription>Добавьте первую запись кнопкой в правом верхнем углу.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      {view === "list" ? (
        <CatalogListView
          ownerColumn={ownerColumn}
          sharedLabel={sharedLabel}
          entries={viewEntries}
          onOpen={setOpenedId}
          onToggleStar={toggleStar}
          onRemove={removeEntry}
        />
      ) : (
        <CatalogGridView entries={viewEntries} onOpen={setOpenedId} onToggleStar={toggleStar} onRemove={removeEntry} />
      )}
      <CatalogDetailsDialog
        entry={openedEntry}
        sections={sections}
        ownerColumn={ownerColumn}
        sharedLabel={sharedLabel}
        onOpenChange={(open) => {
          if (!open) setOpenedId(null);
        }}
      />
    </>
  );
}

"use client";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { CatalogDetailSection, CatalogViewEntry } from "./catalog-types";
import { formatPrice, formatSpecValue, hasSpecValue, sumMoney } from "./catalog-utils";

interface CatalogDetailsDialogProps {
  entry: CatalogViewEntry | null;
  sections: CatalogDetailSection[];
  ownerColumn: string;
  sharedLabel: string;
  onOpenChange: (open: boolean) => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2 text-sm last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export function CatalogDetailsDialog({
  entry,
  sections,
  ownerColumn,
  sharedLabel,
  onOpenChange,
}: CatalogDetailsDialogProps) {
  const visibleSections = entry
    ? sections
        .map((section) => ({
          section,
          fields: section.fields.filter((field) => hasSpecValue(field, entry.details?.[field.key])),
        }))
        .filter(({ fields }) => fields.length > 0)
    : [];

  return (
    <Dialog open={entry !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        {entry && (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <DialogTitle className="text-lg">{entry.name}</DialogTitle>
                {entry.isNew && <Badge>Новый</Badge>}
              </div>
              <DialogDescription>
                {entry.kindLabel}
                {entry.shared ? ` · ${sharedLabel}` : ""}
              </DialogDescription>
            </DialogHeader>

            <dl className="rounded-lg border px-3">
              <Row label="Цена" value={entry.price} />
              <Row label={ownerColumn} value={entry.owner} />
              <Row label="Изменено" value={entry.modifiedAt} />
            </dl>

            {visibleSections.length === 0 && sections.length > 0 && (
              <p className="text-muted-foreground text-sm">Подробные данные для этой записи пока не заполнены.</p>
            )}

            {visibleSections.map(({ section, fields }) => {
              const total = section.totalLabel ? sumMoney(section, entry.details) : 0;

              return (
                <section key={section.id} className="flex flex-col gap-2">
                  <h3 className="font-medium text-sm">{section.title}</h3>
                  <dl className="rounded-lg border px-3">
                    {fields.map((field) => (
                      <Row key={field.key} label={field.label} value={formatSpecValue(field, entry.details?.[field.key])} />
                    ))}
                    {section.totalLabel && total > 0 && (
                      <Row label={section.totalLabel} value={formatPrice(String(total))} />
                    )}
                  </dl>
                </section>
              );
            })}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { cn } from "cn";
import { Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { CatalogActions } from "./catalog-actions";
import type { CatalogViewEntry } from "./catalog-types";

interface CatalogGridViewProps {
  entries: CatalogViewEntry[];
  onOpen: (entryId: string) => void;
  onToggleStar: (entryId: string) => void;
  onRemove: (entryId: string) => void;
}

export function CatalogGridView({ entries, onOpen, onToggleStar, onRemove }: CatalogGridViewProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {entries.map((entry) => (
        <Card key={entry.id} size="sm" className="group/entry">
          <CardContent>
            <div className="relative flex h-36 items-center justify-center rounded-lg bg-muted/50">
              <div className="text-muted-foreground [&>svg]:size-12" aria-hidden="true">
                {entry.icon}
              </div>
              {entry.isNew && (
                <Badge className="absolute top-2 left-2" variant="secondary">
                  Новый
                </Badge>
              )}
              <Button
                variant="secondary"
                size="icon-sm"
                className={cn(
                  "absolute top-2 right-2 opacity-0 focus-visible:opacity-100 group-hover/entry:opacity-100",
                  entry.starred && "opacity-100",
                )}
                aria-label={entry.starred ? `Убрать из избранного: ${entry.name}` : `В избранное: ${entry.name}`}
                onClick={() => onToggleStar(entry.id)}
              >
                <Star className={cn(entry.starred && "fill-current")} />
              </Button>
              <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 text-muted-foreground text-xs">
                <span>{entry.kindLabel}</span>
                <span>{entry.price}</span>
              </div>
            </div>
          </CardContent>
          <CardHeader>
            <CardTitle className="truncate">
              <button
                type="button"
                className="max-w-full truncate text-left hover:underline focus-visible:underline focus-visible:outline-none"
                onClick={() => onOpen(entry.id)}
              >
                {entry.name}
              </button>
            </CardTitle>
            <CardDescription className="truncate">
              Изменено: {entry.modifiedAt} · {entry.owner}
            </CardDescription>
            <CardAction>
              <CatalogActions
                entry={entry}
                onOpen={() => onOpen(entry.id)}
                onToggleStar={() => onToggleStar(entry.id)}
                onRemove={() => onRemove(entry.id)}
              />
            </CardAction>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

"use client";

import { cn } from "cn";
import { Star } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { CatalogActions } from "./catalog-actions";
import type { CatalogViewEntry } from "./catalog-types";

interface CatalogListViewProps {
  ownerColumn: string;
  sharedLabel: string;
  entries: CatalogViewEntry[];
  onOpen: (entryId: string) => void;
  onToggleStar: (entryId: string) => void;
  onRemove: (entryId: string) => void;
}

export function CatalogListView({
  ownerColumn,
  sharedLabel,
  entries,
  onOpen,
  onToggleStar,
  onRemove,
}: CatalogListViewProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-0">Название</TableHead>
          <TableHead className="hidden md:table-cell">{ownerColumn}</TableHead>
          <TableHead className="hidden lg:table-cell">Изменено</TableHead>
          <TableHead className="hidden sm:table-cell">Цена</TableHead>
          <TableHead className="w-20">
            <span className="sr-only">Действия</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="pl-0">
              <div className="flex min-w-0 items-center gap-3">
                <div className="shrink-0 text-muted-foreground [&>svg]:size-5" aria-hidden="true">
                  {entry.icon}
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto max-w-72 justify-start px-0"
                  onClick={() => onOpen(entry.id)}
                >
                  <span className="truncate">{entry.name}</span>
                </Button>
                {entry.isNew && <Badge>Новый</Badge>}
                {entry.shared && (
                  <Badge variant="outline" className="hidden xl:inline-flex">
                    {sharedLabel}
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <div className="flex items-center gap-2">
                <Avatar size="sm">
                  <AvatarFallback>{entry.ownerInitials}</AvatarFallback>
                </Avatar>
                <span>{entry.owner}</span>
              </div>
            </TableCell>
            <TableCell className="hidden text-muted-foreground lg:table-cell">{entry.modifiedAt}</TableCell>
            <TableCell className="hidden text-muted-foreground sm:table-cell">{entry.price}</TableCell>
            <TableCell>
              <div className="flex items-center justify-end">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={entry.starred ? `Убрать из избранного: ${entry.name}` : `В избранное: ${entry.name}`}
                  onClick={() => onToggleStar(entry.id)}
                >
                  <Star className={cn(entry.starred && "fill-current")} />
                </Button>
                <CatalogActions
                  entry={entry}
                  onOpen={() => onOpen(entry.id)}
                  onToggleStar={() => onToggleStar(entry.id)}
                  onRemove={() => onRemove(entry.id)}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

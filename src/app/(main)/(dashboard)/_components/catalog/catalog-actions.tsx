import { Copy, Info, MoreVertical, Share2, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { CatalogEntry } from "./catalog-types";

interface CatalogActionsProps {
  entry: CatalogEntry;
  onOpen: () => void;
  onToggleStar: () => void;
  onRemove: () => void;
}

export function CatalogActions({ entry, onOpen, onToggleStar, onRemove }: CatalogActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Действия: ${entry.name}`}>
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52" align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onOpen}>
            <Info />
            Подробнее
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onToggleStar}>
            <Star />
            {entry.starred ? "Убрать из избранного" : "В избранное"}
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Copy />
            Скопировать ID
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Share2 />
            Скопировать ссылку
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onSelect={onRemove}>
            <Trash2 />
            Убрать из каталога
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

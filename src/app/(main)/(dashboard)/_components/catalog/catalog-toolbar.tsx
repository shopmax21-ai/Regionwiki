import { ArrowUpDown, Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

import type { CatalogConfig } from "./catalog-types";

interface CatalogToolbarProps {
  config: CatalogConfig;
}

export function CatalogToolbar({ config }: CatalogToolbarProps) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
      <InputGroup className="md:max-w-lg">
        <InputGroupInput placeholder={config.searchPlaceholder} aria-label={config.searchPlaceholder} data-section-search />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
      </InputGroup>
      <div className="flex flex-1 flex-wrap items-center gap-2 xl:justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal data-icon="inline-start" />
              Фильтры и сортировка
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Показать</DropdownMenuLabel>
              <DropdownMenuRadioGroup value="all">
                <DropdownMenuRadioItem value="all">Все</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="starred">Избранное</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="shared">{config.sharedLabel}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <SlidersHorizontal />
                  {config.kindFilterLabel}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent sideOffset={8}>
                  <DropdownMenuGroup>
                    <DropdownMenuRadioGroup value="all">
                      <DropdownMenuRadioItem value="all">Все типы</DropdownMenuRadioItem>
                      {config.kinds.map((kind) => (
                        <DropdownMenuRadioItem key={kind.value} value={kind.value}>
                          {kind.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ArrowUpDown />
                  Сортировка
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent sideOffset={8}>
                  <DropdownMenuGroup>
                    <DropdownMenuRadioGroup value="modified">
                      <DropdownMenuRadioItem value="modified">По дате изменения</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="name">По названию</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="price">По цене</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

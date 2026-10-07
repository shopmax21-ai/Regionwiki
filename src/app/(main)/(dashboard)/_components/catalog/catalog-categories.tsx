import { Clock, Folder, MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

import type { CatalogConfig } from "./catalog-types";
import { pluralize } from "./catalog-utils";

interface CatalogCategoriesProps {
  config: CatalogConfig;
}

export function CatalogCategories({ config }: CatalogCategoriesProps) {
  const { categories } = config;

  return (
    <section className="flex flex-col gap-2" aria-labelledby={`${config.domain}-categories-heading`}>
      <div className="flex items-center justify-between">
        <h2 id={`${config.domain}-categories-heading`} className="font-medium text-lg">
          {config.categoriesTitle}
        </h2>
        <span className="text-muted-foreground text-sm">
          {categories.length} {pluralize(categories.length, config.categoryForms)}
        </span>
      </div>
      {categories.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {categories.map((category) => (
            <Card key={category.id} size="sm">
              <CardHeader>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Folder className="size-4.5" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <CardTitle className="truncate leading-none">{category.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {category.count} {pluralize(category.count, config.entryForms)}
                    </CardDescription>
                  </div>
                </div>
                <CardAction>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Действия: ${category.name}`}>
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        <DropdownMenuItem>Открыть категорию</DropdownMenuItem>
                        <DropdownMenuItem>Скопировать ссылку</DropdownMenuItem>
                        <DropdownMenuItem>Переименовать</DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardAction>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 text-muted-foreground text-xs">
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  <span>Обновлено: {category.updatedAt}</span>
                </div>
                <span>{category.priceFrom}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Empty className="min-h-32">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Folder />
            </EmptyMedia>
            <EmptyTitle>{config.categoriesEmptyTitle}</EmptyTitle>
            <EmptyDescription>{config.categoriesEmptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  );
}

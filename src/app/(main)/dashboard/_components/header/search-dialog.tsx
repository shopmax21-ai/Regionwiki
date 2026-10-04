"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { LoaderCircle, Search } from "lucide-react";

import { SearchExternalIcon, SearchHighlight, searchKindIcons } from "@/components/search/search-ui";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useSiteSearch } from "@/hooks/use-site-search";
import type { SearchHit } from "@/lib/search/types";
import type { NavMainItem } from "@/navigation/sidebar/sidebar-items";
import {
  type JobNavLink,
  type NavGroup,
  sidebarItems,
  visibleSidebarItems,
} from "@/navigation/sidebar/sidebar-items";

type NavEntry = {
  id: string;
  group: string;
  label: string;
  url: string;
  icon?: NavMainItem["icon"];
  disabled?: boolean;
  newTab?: boolean;
};

const sidebarGroupLabels = new Set(sidebarItems.flatMap((group) => (group.label ? [group.label] : [])));

function getSubItemGroup(groupLabel: string | undefined, itemTitle: string) {
  return sidebarGroupLabels.has(itemTitle) ? (groupLabel ?? "Другое") : itemTitle;
}

function buildNavEntries(groups: NavGroup[]): NavEntry[] {
  return groups.flatMap((group) =>
    group.items.flatMap((item) => {
      if (item.subItems) {
        return item.subItems.map((sub) => ({
          id: sub.id,
          group: getSubItemGroup(group.label, item.title),
          label: sub.title,
          url: sub.url,
          icon: item.icon,
          disabled: sub.disabled,
          newTab: sub.newTab,
        }));
      }
      return [
        {
          id: item.id,
          group: group.label ?? "Другое",
          label: item.title,
          url: item.url,
          icon: item.icon,
          disabled: item.disabled,
          newTab: item.newTab,
        },
      ];
    }),
  );
}

const isRecommended = (item: NavEntry) => !item.disabled && !item.url.includes("coming-soon");

function groupNav(items: NavEntry[]) {
  const groups = [...new Set(items.map((item) => item.group))];
  return groups.map((group) => ({ group, items: items.filter((item) => item.group === group) }));
}

export function SearchDialog({
  authorized = false,
  isAdmin = false,
  permissions = [],
  jobs = [],
}: {
  authorized?: boolean;
  isAdmin?: boolean;
  permissions?: string[];
  jobs?: JobNavLink[];
}) {
  const recommendations = React.useMemo(
    () => buildNavEntries(visibleSidebarItems({ authorized, isAdmin, permissions }, jobs)).filter(isRecommended),
    [authorized, isAdmin, permissions, jobs],
  );
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const router = useRouter();
  const search = useSiteSearch(query, { limit: 5 });
  const trimmed = query.trim();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) setQuery("");
  };

  const openUrl = (url: string, options: { external?: boolean } = {}) => {
    handleOpenChange(false);
    if (options.external) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      router.push(url);
    }
  };

  // Пока запрос короче двух символов — просто фильтруем меню слева, на сервер не ходим
  const shortFiltered = React.useMemo(() => {
    if (!trimmed) return recommendations;
    const needle = trimmed.toLowerCase();
    return recommendations.filter((item) => item.label.toLowerCase().includes(needle));
  }, [trimmed, recommendations]);

  const showRemote = search.active;

  const renderHit = (hit: SearchHit) => {
    const Icon = searchKindIcons[hit.kind];
    return (
      <CommandItem key={hit.id} value={hit.id} onSelect={() => openUrl(hit.href, { external: hit.external })}>
        <Icon />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">
            <SearchHighlight text={hit.title} query={trimmed} />
          </span>
          {Boolean(hit.snippet ?? hit.subtitle) && (
            <span className="truncate text-muted-foreground text-xs">
              {hit.snippet ? <SearchHighlight text={hit.snippet} query={trimmed} /> : hit.subtitle}
            </span>
          )}
        </span>
        {hit.external && <SearchExternalIcon className="size-3.5 shrink-0 text-muted-foreground" />}
      </CommandItem>
    );
  };

  return (
    <>
      <Button
        onClick={() => handleOpenChange(true)}
        variant="link"
        className="px-0! font-normal text-muted-foreground hover:no-underline"
      >
        <Search data-icon="inline-start" />
        Поиск
        <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium text-[10px]">
          <span className="text-xs">⌘</span>J
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Поиск по сайту"
        description="Правила, работы, транспорт, бизнесы, недвижимость, карта и разделы"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Правила, работы, транспорт, недвижимость…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[min(28rem,70dvh)]">
            {showRemote ? (
              <>
                {search.loading && (
                  <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
                    <LoaderCircle className="size-4 animate-spin" />
                    Ищем…
                  </div>
                )}
                {!search.loading && search.error && (
                  <div className="py-6 text-center text-muted-foreground text-sm">
                    Не удалось выполнить поиск. Попробуйте ещё раз.
                  </div>
                )}
                {!search.loading && !search.error && search.groups.length === 0 && (
                  <CommandEmpty>По запросу «{trimmed}» ничего не найдено.</CommandEmpty>
                )}
                {!search.loading &&
                  search.groups.map((group, index) => (
                    <React.Fragment key={group.kind}>
                      {index > 0 && <CommandSeparator />}
                      <CommandGroup
                        heading={group.total > group.hits.length ? `${group.label} · ${group.total}` : group.label}
                      >
                        {group.hits.map(renderHit)}
                      </CommandGroup>
                    </React.Fragment>
                  ))}
              </>
            ) : (
              <>
                {shortFiltered.length === 0 && <CommandEmpty>Ничего не найдено.</CommandEmpty>}
                {groupNav(shortFiltered).map(({ group, items }, index) => (
                  <React.Fragment key={group}>
                    {index > 0 && <CommandSeparator />}
                    <CommandGroup heading={group}>
                      {items.map((item) => (
                        <CommandItem
                          key={`${group}-${item.id}`}
                          value={`${group}-${item.id}`}
                          onSelect={() => openUrl(item.url, { external: item.newTab })}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {item.icon && <item.icon />}
                            <span className="truncate">{item.label}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </React.Fragment>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { ArrowDownUp, ChevronRight, Funnel, Search, UserCheck, X } from "lucide-react";

import { FilterDropdown } from "@/app/(main)/(dashboard)/_components/filter-dropdown";
import { PersonAvatar } from "@/components/person-avatar";
import { PersonName } from "@/components/person-name";
import { ProfileBanner } from "@/components/profile-banner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type AdminGroup, adminGroups, groupInfo, groupLevel } from "@/lib/auth/groups";
import type { Person } from "@/lib/auth/person";
import { personLabel } from "@/lib/auth/person";

export type StaffMember = {
  person: Person;
  /** ISO-дата последнего входа или null */
  lastLoginAt: string | null;
};

type SortMode = "senior" | "junior" | "alpha";

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: "senior", label: "Старшие сверху" },
  { id: "junior", label: "Младшие сверху" },
  { id: "alpha", label: "По алфавиту" },
];

type RoleFilter = AdminGroup | "all";

// Старшие группы сверху, как и в списке
const ROLE_OPTIONS: { id: RoleFilter; label: string }[] = [
  { id: "all", label: "Все роли" },
  ...[...adminGroups].reverse().map((group) => ({ id: group, label: groupInfo[group].label })),
];

const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" });

const normalize = (value: string) => value.toLowerCase().replaceAll("ё", "е").trim();

/** Список администрации: поиск, фильтр по роли и сортировка кнопками с иконкой (как на других страницах) и карточки с переходом в профиль. */
export function StaffList({ members, meId }: { members: StaffMember[]; meId: string }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [sort, setSort] = useState<SortMode>("senior");

  const visible = useMemo(() => {
    const needle = normalize(query).replace(/^#/, "");
    const filtered = members.filter(({ person }) => {
      if (role !== "all" && person.group !== role) return false;
      if (!needle) return true;
      const haystack = normalize(`${person.nickname ?? ""} ${person.name} ${person.staticId ?? ""}`);
      return haystack.includes(needle);
    });
    const byName = (a: StaffMember, b: StaffMember) => personLabel(a.person).localeCompare(personLabel(b.person), "ru");
    return filtered.sort((a, b) => {
      if (sort === "alpha") return byName(a, b);
      const diff = groupLevel(b.person.group) - groupLevel(a.person.group);
      return (sort === "senior" ? diff : -diff) || byName(a, b);
    });
  }, [members, query, role, sort]);

  const filtering = query.trim() !== "" || role !== "all";

  return (
    <div className="flex w-full flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-xl">Администрация</h1>
        <p className="text-muted-foreground text-sm">
          Нажмите на карточку, чтобы открыть профиль и статистику администратора.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по нику, имени или Static ID"
            aria-label="Поиск по администраторам"
            data-section-search
            className="pr-9 pl-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
              className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            icon={Funnel}
            label="Роль"
            value={role}
            options={ROLE_OPTIONS}
            onChange={setRole}
            className="max-sm:flex-1"
          />
          <FilterDropdown
            icon={ArrowDownUp}
            label="Сортировка"
            value={sort}
            options={SORT_OPTIONS}
            onChange={setSort}
            className="max-sm:flex-1"
          />
        </div>
      </div>

      {members.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Администраторов пока нет.
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Никого не нашли{filtering ? ": попробуйте изменить поиск или роль." : "."}
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-xs" aria-live="polite">
            {filtering ? `Найдено: ${visible.length} из ${members.length}` : `Всего: ${members.length}`}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map(({ person, lastLoginAt }) => {
              const own = person.id === meId;
              return (
                <li key={person.id} className="h-full">
                  <Link
                    href={own ? "/profile" : `/profile/${encodeURIComponent(person.id)}`}
                    prefetch={false}
                    className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <Card className="relative h-full overflow-hidden transition-colors group-hover:bg-muted/40">
                      {person.background && <ProfileBanner src={person.background} />}
                      <CardContent className="relative z-10 flex min-h-16 items-center gap-3">
                        <PersonAvatar id={person.id} name={person.name} className="size-12 rounded-xl text-base" />
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <PersonName person={person} showRole={true} className="text-sm" />
                          <span className="truncate text-muted-foreground text-xs">
                            {lastLoginAt
                              ? `Был(а) на сайте: ${dateFormat.format(new Date(lastLoginAt))}`
                              : "Ещё не входил(а)"}
                          </span>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </CardContent>
                      {own && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              role="img"
                              aria-label="Это вы"
                              className="absolute top-2 right-2 z-20 inline-flex cursor-default text-primary"
                            >
                              <UserCheck className="size-4" aria-hidden="true" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">Это вы</TooltipContent>
                        </Tooltip>
                      )}
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

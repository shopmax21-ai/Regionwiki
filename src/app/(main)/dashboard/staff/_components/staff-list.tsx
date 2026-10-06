import Link from "next/link";

import { ChevronRight } from "lucide-react";

import { PersonName } from "@/components/person-name";
import { ProfileBanner } from "@/components/profile-banner";
import { RoleBadge } from "@/components/role-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { Person } from "@/lib/auth/person";
import { getInitials } from "@/lib/utils";

export type StaffMember = {
  person: Person;
  /** ISO-дата последнего входа или null */
  lastLoginAt: string | null;
};

const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" });

/** Список администрации: карточки с переходом в профиль и статистику каждого. */
export function StaffList({ members, meId }: { members: StaffMember[]; meId: string }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-xl">Администрация</h1>
        <p className="text-muted-foreground text-sm">
          Нажмите на карточку, чтобы открыть профиль и статистику администратора.
        </p>
      </div>

      {members.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Администраторов пока нет.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {members.map(({ person, lastLoginAt }) => {
            const own = person.id === meId;
            return (
              <li key={person.id}>
                <Link
                  href={own ? "/dashboard/profile" : `/dashboard/profile/${encodeURIComponent(person.id)}`}
                  prefetch={false}
                  className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <Card className="relative overflow-hidden transition-colors group-hover:bg-muted/40">
                    {person.background && <ProfileBanner src={person.background} />}
                    <CardContent className="relative z-10 flex items-center gap-3">
                      <Avatar className="size-12 shrink-0 rounded-xl">
                        <AvatarImage src={`/api/auth/avatar?id=${encodeURIComponent(person.id)}`} alt={person.name} />
                        <AvatarFallback className="rounded-xl">{getInitials(person.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <PersonName person={person} showRole={true} className="text-sm" />
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {own && <span className="text-muted-foreground text-xs">это вы</span>}
                        </div>
                        <span className="truncate text-muted-foreground text-xs">
                          {lastLoginAt
                            ? `Был(а) на сайте: ${dateFormat.format(new Date(lastLoginAt))}`
                            : "Ещё не входил(а)"}
                        </span>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

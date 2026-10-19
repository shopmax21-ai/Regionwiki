import { cn } from "cn";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export const profileDateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short" });

export type ProfileStat = { icon: LucideIcon; label: string; value: string; mono?: boolean };

/** Плитки с короткими цифрами профиля: Telegram ID, даты входа, число входов. */
export function ProfileStatTiles({ stats }: { stats: ProfileStat[] }) {
  return (
    <div className={stats.length > 3 ? "grid gap-4 sm:grid-cols-2 md:gap-6" : "grid gap-4 sm:grid-cols-3 md:gap-6"}>
      {stats.map(({ icon: Icon, label, value, mono }) => (
        <Card key={label} className="py-0">
          <CardContent className="flex items-center gap-3 py-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-muted-foreground text-xs">{label}</span>
              <span className={cn("truncate font-semibold text-sm tabular-nums", mono && "font-mono")}>{value}</span>
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

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
        <Card key={label}>
          <CardContent className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Icon className="size-3.5" />
              {label}
            </span>
            <span className={cn("truncate font-medium text-sm tabular-nums", mono && "font-mono")}>{value}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

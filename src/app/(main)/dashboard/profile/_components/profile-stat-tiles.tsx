import type { LucideIcon } from "lucide-react";

export const profileDateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short" });

export type ProfileStat = { icon: LucideIcon; label: string; value: string };

/** Короткие цифры профиля: Telegram ID, даты входа, число входов. Показываются внутри блока профиля. */
export function ProfileStatTiles({ stats }: { stats: ProfileStat[] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-3 md:min-w-0 md:shrink-0">
      {stats.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-muted/50 px-4 py-2.5">
          <dt className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </dt>
          <dd className="font-medium text-sm tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

import { Ban, CheckCircle2, Clock3, Hourglass, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { helperStatus, type PunishmentStatus, STATUS_LABELS } from "@/lib/punishments/types";

/** Статус глазами хелпера: «Ожидает администратора / На рассмотрении / Выдано / Отклонено». */
export function HelperStatusBadge({ status }: { status: PunishmentStatus }) {
  const { label, tone } = helperStatus({ status });
  if (tone === "done") {
    return (
      <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400">
        <CheckCircle2 data-icon="inline-start" />
        {label}
      </Badge>
    );
  }
  if (tone === "rejected") {
    return (
      <Badge variant="destructive">
        <Ban data-icon="inline-start" />
        {label}
      </Badge>
    );
  }
  if (tone === "progress") {
    return (
      <Badge variant="secondary">
        <Hourglass data-icon="inline-start" />
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Clock3 data-icon="inline-start" />
      {label}
    </Badge>
  );
}

/** Точный статус для администраторов: «Ожидает / В работе / Одобрена / Выдано / Отклонено». */
export function AdminStatusBadge({ status }: { status: PunishmentStatus }) {
  if (status === "issued") {
    return (
      <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400">
        <ShieldCheck data-icon="inline-start" />
        {STATUS_LABELS.issued}
      </Badge>
    );
  }
  if (status === "rejected") return <Badge variant="destructive">{STATUS_LABELS.rejected}</Badge>;
  if (status === "pending") return <Badge variant="outline">{STATUS_LABELS.pending}</Badge>;
  return <Badge variant="secondary">{STATUS_LABELS[status]}</Badge>;
}

export function RuleChips({ rules }: { rules: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {rules.map((rule) => (
        <Badge key={rule} variant="outline" className="font-mono">
          {rule}
        </Badge>
      ))}
    </span>
  );
}

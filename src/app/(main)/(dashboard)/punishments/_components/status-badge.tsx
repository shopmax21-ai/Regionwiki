import { Ban, CheckCircle2, Clock3, Hourglass, ShieldCheck } from "lucide-react";

import { StatusIcon } from "@/components/status-icon";
import { Badge } from "@/components/ui/badge";
import {
  helperStatus,
  MUTE_CHANNEL_LABELS,
  type MuteChannel,
  type PunishmentKind,
  type PunishmentStatus,
  STATUS_LABELS,
} from "@/lib/punishments/types";

export const PUNISHMENT_KIND_COLORS: Record<PunishmentKind, string> = {
  jail: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  mute: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  ban: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  hardban: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  warn: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

export function PunishmentKindBadge({
  kind,
  muteChannel,
}: {
  kind: PunishmentKind;
  muteChannel: MuteChannel | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant="outline" className={`font-mono ${PUNISHMENT_KIND_COLORS[kind]}`}>
        /{kind}
      </Badge>
      {kind === "mute" && muteChannel && (
        <span className="text-muted-foreground text-xs">{MUTE_CHANNEL_LABELS[muteChannel].toLowerCase()}</span>
      )}
    </span>
  );
}

/** Статус глазами хелпера: «Ожидает администратора / На рассмотрении / Выдано / Отклонено». */
export function HelperStatusBadge({ status, compact = false }: { status: PunishmentStatus; compact?: boolean }) {
  const { label, tone } = helperStatus({ status });
  if (compact) {
    if (tone === "done") return <StatusIcon icon={CheckCircle2} label={label} tone="green" />;
    if (tone === "rejected") return <StatusIcon icon={Ban} label={label} tone="red" />;
    if (tone === "progress") return <StatusIcon icon={Hourglass} label={label} tone="blue" />;
    return <StatusIcon icon={Clock3} label={label} tone="muted" />;
  }
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
export function AdminStatusBadge({ status, compact = false }: { status: PunishmentStatus; compact?: boolean }) {
  if (compact) {
    const label = STATUS_LABELS[status];
    if (status === "issued") return <StatusIcon icon={ShieldCheck} label={label} tone="green" />;
    if (status === "rejected") return <StatusIcon icon={Ban} label={label} tone="red" />;
    if (status === "pending") return <StatusIcon icon={Clock3} label={label} tone="muted" />;
    if (status === "approved") return <StatusIcon icon={CheckCircle2} label={label} tone="blue" />;
    return <StatusIcon icon={Hourglass} label={label} tone="blue" />;
  }
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

import { CheckCircle2, Clock3, Radio } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { type EventStatus, STATUS_LABELS } from "@/lib/calendar/types";

export function StatusBadge({ status }: { status: EventStatus }) {
  if (status === "live") {
    return (
      <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400">
        <Radio data-icon="inline-start" />
        {STATUS_LABELS.live}
      </Badge>
    );
  }
  if (status === "upcoming") {
    return (
      <Badge variant="secondary">
        <Clock3 data-icon="inline-start" />
        {STATUS_LABELS.upcoming}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <CheckCircle2 data-icon="inline-start" />
      {STATUS_LABELS.finished}
    </Badge>
  );
}

import { cn } from "cn";

import { Badge } from "@/components/ui/badge";

import type { JobKind } from "../_data/jobs";

const kindClass: Record<JobKind, string> = {
  legal: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  illegal: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
};

export function KindBadge({ kind, className }: { kind: JobKind; className?: string }) {
  return (
    <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5", kindClass[kind], className)}>
      {kind === "legal" ? "Легальная" : "Нелегальная"}
    </Badge>
  );
}

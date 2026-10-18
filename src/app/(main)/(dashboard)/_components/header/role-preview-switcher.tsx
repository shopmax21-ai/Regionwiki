"use client";

import { useTransition } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { type AdminGroup, groupInfo } from "@/lib/auth/groups";

import { setRolePreview } from "../../_actions";

export function RolePreviewSwitcher({
  actualGroup,
  previewGroup,
}: {
  actualGroup: AdminGroup;
  previewGroup: AdminGroup | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const changeRole = (value: string) => {
    startTransition(async () => {
      const result = await setRolePreview(value || null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <label className="flex items-center gap-2 text-muted-foreground text-xs">
      <span className="hidden sm:inline">{previewGroup ? "Просмотр как:" : "Роль:"}</span>
      <select
        aria-label="Просмотр сайта от имени роли"
        className="h-8 w-28 min-w-0 rounded-md border border-input bg-background px-2 text-foreground text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:w-44"
        value={previewGroup ?? ""}
        disabled={pending}
        onChange={(event) => changeRole(event.target.value)}
      >
        <option value="">Моя роль ({groupInfo[actualGroup].label})</option>
        {Object.entries(groupInfo).map(([group, info]) => (
          <option key={group} value={group}>
            {info.label}
          </option>
        ))}
      </select>
    </label>
  );
}

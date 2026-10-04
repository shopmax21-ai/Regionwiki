"use client";

import { Fragment, useState } from "react";

import { Check, Lock, Minus, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  type AdminGroup,
  adminGroups,
  type EditableGroup,
  groupInfo,
  type Permission,
  permissionDefs,
} from "@/lib/auth/groups";

import { setGroupPermissionAction } from "../_actions";

type Member = { name: string; username: string | null };

const categories = Array.from(new Set(permissionDefs.map((def) => def.category)));

export function RolesManager({
  permissions,
  members,
  canEdit,
  myGroup,
}: {
  permissions: Record<AdminGroup, Permission[]>;
  members: Record<AdminGroup, Member[]>;
  canEdit: boolean;
  myGroup: AdminGroup;
}) {
  const [matrix, setMatrix] = useState(permissions);
  const [saving, setSaving] = useState<Set<string>>(new Set());

  const has = (group: AdminGroup, permission: Permission) => matrix[group].includes(permission);

  const toggle = async (group: EditableGroup, permission: Permission, enabled: boolean) => {
    const key = `${group}:${permission}`;
    const apply = (value: boolean) =>
      setMatrix((prev) => ({
        ...prev,
        [group]: value
          ? [...prev[group].filter((item) => item !== permission), permission]
          : prev[group].filter((item) => item !== permission),
      }));

    apply(enabled);
    setSaving((prev) => new Set(prev).add(key));

    const result = await setGroupPermissionAction(group, permission, enabled).catch(() => ({
      ok: false as const,
      error: "Нет связи с сервером, попробуйте ещё раз",
    }));

    setSaving((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    if (!result.ok) {
      apply(!enabled);
      toast.error(result.error);
    }
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Роли и права</CardTitle>
          <CardDescription>
            Четыре группы администраторов. Старшая группа может назначать младшие, а Гл.Администратор настраивает, что
            доступно каждой из них.
            {!canEdit && " Сейчас вы можете только смотреть: менять права может Гл.Администратор."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {adminGroups.map((group) => {
            const info = groupInfo[group];
            const list = members[group];
            return (
              <div
                key={group}
                className={`flex flex-col gap-3 rounded-xl border p-4 ${group === myGroup ? "border-primary/60 bg-primary/5" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold leading-tight">{info.label}</h2>
                    <p className="text-muted-foreground text-xs">Уровень {info.level}</p>
                  </div>
                  {group === myGroup && <Badge variant="secondary">Ваша группа</Badge>}
                </div>
                <p className="text-muted-foreground text-sm">{info.description}</p>
                <div className="mt-auto flex flex-col gap-2 text-sm">
                  <p className="text-muted-foreground">
                    Прав: <span className="font-medium text-foreground">{matrix[group].length}</span> из{" "}
                    {permissionDefs.length}
                  </p>
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="size-4" aria-hidden="true" />В группе:{" "}
                    <span className="font-medium text-foreground">{list.length}</span>
                  </p>
                  {list.length > 0 && (
                    <p className="line-clamp-2 text-muted-foreground text-xs">
                      {list
                        .map((member) => (member.username ? `${member.name} (@${member.username})` : member.name))
                        .join(", ")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Право</TableHead>
                {adminGroups.map((group) => (
                  <TableHead key={group} className="w-28 text-center">
                    {groupInfo[group].label}
                    {group === "chief" && (
                      <Lock className="ml-1 inline size-3 align-[-1px]" aria-label="Права зафиксированы" />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <Fragment key={category}>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell
                      colSpan={adminGroups.length + 1}
                      className="pl-4 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                    >
                      {category}
                    </TableCell>
                  </TableRow>
                  {permissionDefs
                    .filter((def) => def.category === category)
                    .map((def) => (
                      <TableRow key={def.key}>
                        <TableCell className="whitespace-normal pl-4">
                          <p className="font-medium text-sm">{def.label}</p>
                          <p className="text-muted-foreground text-xs">{def.description}</p>
                        </TableCell>
                        {adminGroups.map((group) => {
                          const granted = has(group, def.key);
                          const editable = canEdit && group !== "chief" && !def.locked;
                          return (
                            <TableCell key={group} className="text-center">
                              {editable ? (
                                <Switch
                                  checked={granted}
                                  disabled={saving.has(`${group}:${def.key}`)}
                                  onCheckedChange={(value) => toggle(group as EditableGroup, def.key, value)}
                                  aria-label={`${def.label}: ${groupInfo[group].label}`}
                                />
                              ) : granted ? (
                                <>
                                  <Check className="mx-auto size-4 text-primary" aria-hidden="true" />
                                  <span className="sr-only">Есть</span>
                                </>
                              ) : (
                                <>
                                  <Minus className="mx-auto size-4 text-muted-foreground/50" aria-hidden="true" />
                                  <span className="sr-only">Нет</span>
                                </>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="text-center text-muted-foreground text-xs">
        Права Гл.Администратора зафиксированы. Группы назначаются в разделе «Пользователи».
      </p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Copy, EllipsisVertical, LogIn, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import { ProfileBanner } from "@/components/profile-banner";
import { RoleIcon } from "@/components/role-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import type { AdminGroup } from "@/lib/auth/groups";
import { personLabel } from "@/lib/auth/person";
import { getInitials } from "@/lib/utils";

export type SidebarUser = {
  readonly id: string;
  readonly name: string;
  readonly username?: string;
  readonly role: "user" | "admin";
  /** Игровой профиль администратора и его группа (у обычного участника null) */
  readonly nickname: string | null;
  readonly staticId: string | null;
  readonly group: AdminGroup | null;
  /** Баннер профиля: адрес картинки или null */
  readonly background: string | null;
};

const personOf = (user: SidebarUser) => ({
  id: user.id,
  name: user.name,
  nickname: user.nickname,
  staticId: user.staticId,
  group: user.group,
});

function UserAvatar({ user, className }: { user: SidebarUser; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarImage src="/api/auth/avatar" alt={user.name} />
      <AvatarFallback className="rounded-lg">{getInitials(personLabel(user))}</AvatarFallback>
    </Avatar>
  );
}

export function NavUser({
  user,
  permissions = [],
}: {
  readonly user: SidebarUser | null;
  readonly permissions?: readonly string[];
}) {
  const { isMobile } = useSidebar();
  const pathname = usePathname();

  if (!user) {
    const next = pathname.startsWith("/dashboard") ? `?next=${encodeURIComponent(pathname)}` : "";
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            size="lg"
            tooltip="Войти через Telegram"
            className="justify-center bg-foreground/[0.08] font-extrabold text-foreground uppercase tracking-wide transition hover:bg-primary hover:text-primary-foreground active:bg-primary active:text-primary-foreground"
          >
            <Link prefetch={false} href={`/auth/v2/login${next}`}>
              {/* В свёрнутом сайдбаре показываем только иконку, текст скрываем */}
              <LogIn className="hidden size-4 group-data-[collapsible=icon]:block" />
              <span className="group-data-[collapsible=icon]:hidden">Войти</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const person = personOf(user);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="relative overflow-hidden data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {/* В свёрнутом сайдбаре остаётся одна аватарка, баннер там не нужен */}
              {user.background && (
                <ProfileBanner
                  src={user.background}
                  overlayClassName="from-sidebar/60 via-sidebar/25"
                  className="group-data-[collapsible=icon]:hidden"
                />
              )}
              <UserAvatar user={user} className="relative z-10 h-8 w-8 rounded-lg" />
              
              <div className="relative z-10 grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.nickname}</span>
                <span className="truncate text-muted-foreground text-xs">
                  {user.staticId ? `#${user.staticId}` : "Static ID не указан"}
                </span>
              </div>

              {/* Иконка роли справа в закруглённом квадрате */}
              {user.group && (
                <div className="relative z-10 ml-auto flex size-7 shrink-0 items-center justify-center rounded-md border bg-background/50 backdrop-blur-xs group-data-[collapsible=icon]:hidden">
                  <RoleIcon group={user.group} className="h-3.5 px-0" />
                </div>
              )}

              <EllipsisVertical className="relative z-10 ml-1 size-4 shrink-0" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="relative overflow-hidden rounded-md p-0 font-normal">
              {user.background && (
                <ProfileBanner src={user.background} overlayClassName="from-popover/60 via-popover/25" />
              )}
              <div className="relative z-10 flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UserAvatar user={user} className="h-8 w-8 rounded-lg" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.nickname}</span>
                  <span className="truncate text-muted-foreground text-xs">
                    {user.staticId ? `Static ID: #${user.staticId}` : "Static ID не указан"}
                  </span>
                </div>
                {user.group && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background/50">
                    <RoleIcon group={user.group} className="h-3.5 px-0" />
                  </div>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link prefetch={false} href="/dashboard/profile">
                  <UserRound />
                  Профиль
                </Link>
              </DropdownMenuItem>
              {permissions.includes("access.decide") && (
                <DropdownMenuItem asChild>
                  <Link prefetch={false} href="/dashboard/access">
                    <ShieldCheck />
                    Заявки на доступ
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                disabled={!user.staticId}
                onSelect={() => {
                  if (!user.staticId) return;
                  navigator.clipboard
                    .writeText(user.staticId)
                    .then(() => toast.success("Static ID скопирован"))
                    .catch(() => toast.error("Не удалось скопировать ID"));
                }}
              >
                <Copy />
                Скопировать Static ID
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.assign("/auth/v2/login");
              }}
            >
              <LogOut />
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { EllipsisVertical, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { siTelegram } from "simple-icons";
import { toast } from "sonner";

import { SimpleIcon } from "@/components/simple-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { getInitials } from "@/lib/utils";

export type SidebarUser = {
  readonly id: string;
  readonly name: string;
  readonly username?: string;
  readonly role: "user" | "admin";
};

function UserAvatar({ user, className }: { user: SidebarUser; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarImage src="/api/auth/avatar" alt={user.name} />
      <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
    </Avatar>
  );
}

export function NavUser({ user }: { readonly user: SidebarUser | null }) {
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
            className="justify-center bg-primary font-extrabold text-primary-foreground uppercase tracking-wide hover:bg-primary/90 hover:text-primary-foreground"
          >
            <Link prefetch={false} href={`/auth/v2/login${next}`}>
              <SimpleIcon icon={siTelegram} className="size-4" />
              <span>Войти</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const roleLabel = user.role === "admin" ? "Администратор" : "Участник";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserAvatar user={user} className="h-8 w-8 rounded-lg" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-muted-foreground text-xs">
                  {user.username ? `@${user.username}` : roleLabel}
                </span>
              </div>
              <EllipsisVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UserAvatar user={user} className="h-8 w-8 rounded-lg" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-muted-foreground text-xs">ID {user.id}</span>
                </div>
                <Badge variant={user.role === "admin" ? "default" : "secondary"}>{roleLabel}</Badge>
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
              {user.role === "admin" && (
                <DropdownMenuItem asChild>
                  <Link prefetch={false} href="/dashboard/access">
                    <ShieldCheck />
                    Заявки на доступ
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() => {
                  navigator.clipboard
                    .writeText(user.id)
                    .then(() => toast.success("Telegram ID скопирован"))
                    .catch(() => toast.error("Не удалось скопировать ID"));
                }}
              >
                <SimpleIcon icon={siTelegram} className="size-4" />
                Скопировать Telegram ID
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

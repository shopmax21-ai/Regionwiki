"use client";

import { useId, useMemo } from "react";

import Link from "next/link";

import { useShallow } from "zustand/react/shallow";

import { RegionMarkOutline } from "@/app/(main)/auth/_components/region-mark-outline";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { type JobNavLink, visibleSidebarItems } from "@/navigation/sidebar/sidebar-items";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

import { NavMain } from "./nav-main";
import { NavUser, type SidebarUser } from "./nav-user";
import { SupportCard } from "./support-card";

export function AppSidebar({
  user,
  authorized,
  isAdmin,
  permissions,
  jobs,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: SidebarUser | null;
  authorized: boolean;
  isAdmin: boolean;
  permissions: string[];
  jobs: JobNavLink[];
}) {
  const markId = `rmo-sidebar-${useId().replace(/:/g, "")}`;
  const items = useMemo(
    () => visibleSidebarItems({ authorized, isAdmin, permissions }, jobs),
    [authorized, isAdmin, permissions, jobs],
  );
  const { sidebarVariant, sidebarCollapsible, isSynced } = usePreferencesStore(
    useShallow((s) => ({
      sidebarVariant: s.values.sidebar_variant,
      sidebarCollapsible: s.values.sidebar_collapsible,
      isSynced: s.isSynced,
    })),
  );

  const variant = isSynced ? sidebarVariant : props.variant;
  const collapsible = isSynced ? sidebarCollapsible : props.collapsible;

  return (
    <Sidebar {...props} variant={variant} collapsible={collapsible}>
      <SidebarHeader className="border-b border-sidebar-border/60 px-2 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="rounded-xl px-3 hover:bg-sidebar-accent">
              <Link prefetch={false} href="/">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
                  <RegionMarkOutline
                    id={markId}
                    strokeWidth={1.5}
                    className="size-5! group-data-[collapsible=icon]:size-4!"
                  />
                </span>
                <span className="truncate font-semibold text-base tracking-tight">{APP_CONFIG.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="py-2">
        <NavMain items={items} />
      </SidebarContent>
      <SidebarFooter className="gap-2 border-t border-sidebar-border/60 p-2 pt-3">
        <SupportCard />
        <NavUser user={user} permissions={permissions} />
      </SidebarFooter>
    </Sidebar>
  );
}

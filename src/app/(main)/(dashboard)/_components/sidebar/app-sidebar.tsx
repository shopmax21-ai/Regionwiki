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
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link prefetch={false} href="/">
                <RegionMarkOutline
                  id={markId}
                  strokeWidth={1.5}
                  className="size-5! group-data-[collapsible=icon]:size-4!"
                />
                <span className="font-semibold text-base">{APP_CONFIG.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} />
      </SidebarContent>
      <SidebarFooter>
        <SupportCard />
        <NavUser user={user} permissions={permissions} />
      </SidebarFooter>
    </Sidebar>
  );
}

import type { ReactNode } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { requireAdmin } from "@/lib/auth/admin";

import { ChatHeader } from "./_components/chat-header";
import { ChatSidebar } from "./_components/chat-sidebar";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  // Чат открывается и по адресу /chat (в том числе в iframe на странице раздела), поэтому закрываем и его
  await requireAdmin();

  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex flex-col">
        <ChatHeader />
        <div className="flex flex-1">
          <ChatSidebar />
          {children}
        </div>
      </SidebarProvider>
    </div>
  );
}

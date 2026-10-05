import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth/admin";
import { listEvents } from "@/lib/calendar/store";
import type { CalendarEvent } from "@/lib/calendar/types";

import { Calendar } from "./_components/calendar";

export const metadata: Metadata = {
  title: "Календарь мероприятий | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const admin = await requireAdmin();

  let events: CalendarEvent[] = [];
  let problem: string | null = null;
  try {
    events = await listEvents();
  } catch (error) {
    console.error("[calendar] Не удалось загрузить мероприятия", error);
    problem = "база данных недоступна";
  }

  return (
    <Calendar
      events={events}
      serverNow={Date.now()}
      me={{ id: admin.id, canManageAll: admin.permissions.includes("calendar.manage") }}
      problem={problem}
    />
  );
}

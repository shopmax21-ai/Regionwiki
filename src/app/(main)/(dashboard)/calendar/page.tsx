import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth/admin";
import { getUser, listBirthdays } from "@/lib/auth/db";
import { personPlainText } from "@/lib/auth/person";
import type { CalendarBirthday } from "@/lib/birthdays/types";
import { listEvents } from "@/lib/calendar/store";
import type { CalendarEvent } from "@/lib/calendar/types";
import { listMediaPrEntries } from "@/lib/mediapr/store";
import type { MediaPrEntry } from "@/lib/mediapr/types";

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

  // Дни рождения администраторов: если база не ответила, календарь всё равно открывается
  const birthdays: CalendarBirthday[] = await listBirthdays()
    .then((users) =>
      users.flatMap((user) =>
        user.birthday ? [{ id: user.telegramId, label: personPlainText(user), birthday: user.birthday }] : [],
      ),
    )
    .catch((error) => {
      console.error("[calendar] Не удалось загрузить дни рождения", error);
      return [];
    });

  // Настройка слежения в Telegram: если база не ответила, показываем «выключено», а сам календарь остаётся рабочим
  const tracking = await getUser(admin.id)
    .then((user) => user?.notifyCalendar ?? false)
    .catch(() => false);

  // Вкладка «Медиа» нужна сотрудникам медиа: у остальных её нет
  const canMedia = admin.permissions.some(
    (key) => key === "media.manage" || key === "mediapr.view" || key === "calendar.manage",
  );
  let mediaEntries: MediaPrEntry[] | null = null;
  let mediaProblem: string | null = null;
  if (canMedia && admin.permissions.some((key) => key === "mediapr.view" || key === "calendar.manage")) {
    try {
      mediaEntries = await listMediaPrEntries();
    } catch (error) {
      console.error("[calendar] Не удалось загрузить таблицу медиа", error);
      mediaEntries = [];
      mediaProblem = "база данных недоступна";
    }
  }

  return (
    <Calendar
      events={events}
      birthdays={birthdays}
      serverNow={Date.now()}
      me={{ id: admin.id, canManageAll: admin.permissions.includes("calendar.manage"), canMedia }}
      mediaEntries={mediaEntries}
      mediaProblem={mediaProblem}
      tracking={tracking}
      problem={problem}
    />
  );
}

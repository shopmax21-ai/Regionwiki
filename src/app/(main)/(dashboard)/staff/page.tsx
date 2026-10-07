import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth/admin";
import { warmAvatars } from "@/lib/auth/avatar";
import { type DbUser, listAdmins, toPerson } from "@/lib/auth/db";
import { groupLevel } from "@/lib/auth/groups";
import { personLabel } from "@/lib/auth/person";

import { StaffList } from "./_components/staff-list";

export const metadata: Metadata = {
  title: "Администрация | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">{children}</div>;
}

export default async function Page() {
  const me = await requireAdmin();

  let admins: DbUser[];
  try {
    admins = await listAdmins();
  } catch (error) {
    console.error("[staff] Не удалось загрузить список администрации", error);
    return <Notice>База данных недоступна. Список администрации появится, когда подключение восстановится.</Notice>;
  }

  // Фото подгружаются на сервер, пока страница отправляется: к запросам браузера они уже в кэше
  warmAvatars(admins.map((user) => user.telegramId));

  // Сначала старшие группы, внутри группы по алфавиту
  const members = admins
    .map((user) => ({ person: toPerson(user), lastLoginAt: user.lastLoginAt?.toISOString() ?? null }))
    .sort(
      (a, b) =>
        groupLevel(b.person.group) - groupLevel(a.person.group) ||
        personLabel(a.person).localeCompare(personLabel(b.person), "ru"),
    );

  return <StaffList members={members} meId={me.id} />;
}

import { getCurrentUser } from "./current-user";
import { getUser } from "./db";

/** Быстрая проверка по сессии: для показа кнопок. Права при записи всё равно проверяет getAdmin(). */
export async function isAdminSession(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.status === "approved" && user.role === "admin";
}

/** Администратор по данным из базы (роль могла измениться после выдачи сессии) или null. */
export async function getAdmin(): Promise<{ id: string; name: string } | null> {
  const session = await getCurrentUser();
  if (!session) return null;
  try {
    const user = await getUser(session.id);
    return user?.role === "admin" && user.status === "approved" ? { id: session.id, name: session.name } : null;
  } catch {
    return null;
  }
}

import type { NextRequest } from "next/server";

import { type AdminContext, getAdminContextById } from "@/lib/auth/admin";

import { findUserByToken } from "./user-token";

/**
 * Администратор по личному токену оверлея: заголовок «Authorization: Bearer rgo_…».
 * Права берутся из базы при каждом запросе, поэтому снятие права или группы действует сразу.
 */
export async function authenticateOverlayUser(request: NextRequest): Promise<AdminContext | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const telegramId = await findUserByToken(token);
  return telegramId ? getAdminContextById(telegramId) : null;
}

import { type NextRequest, NextResponse } from "next/server";

import { personPlainText } from "@/lib/auth/person";
import { authenticateOverlayUser } from "@/lib/overlay/user-auth";

export const dynamic = "force-dynamic";

/**
 * Проверка ключа оверлея: GET /api/overlay/me (Authorization: Bearer rgo_…).
 * Приложение показывает по ней, кто подключён, и понимает, что ключ отозван или права сняты.
 */
export async function GET(request: NextRequest) {
  const admin = await authenticateOverlayUser(request);
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Ключ не подошёл или отозван" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(
    {
      ok: true,
      name: personPlainText(admin),
      group: admin.group,
      can: {
        replies: admin.permissions.includes("replies.view"),
        punishmentsRequest: admin.permissions.includes("punishments.request"),
        punishmentsReview: admin.permissions.includes("punishments.review"),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

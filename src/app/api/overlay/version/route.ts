import { type NextRequest, NextResponse } from "next/server";

import { getLatestRelease } from "@/lib/overlay/release";
import { authenticateOverlayRequest } from "@/lib/overlay/user-auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Сведения о свежей версии для автообновления программы: GET /api/overlay/version (Authorization: Bearer rgo_…).
 * Файл подписывает выпускающий сборку (npm run sign в overlay-app): подпись лежит рядом как «<сборка>.exe.sig»,
 * а программа проверяет её своим вшитым открытым ключом. Без подписи программа обновление не поставит.
 */
export async function GET(request: NextRequest) {
  const admin = await authenticateOverlayRequest(request);
  if (!admin)
    return NextResponse.json({ ok: false, error: "Ключ не подошёл или отозван" }, { status: 401, headers: NO_STORE });

  try {
    const release = await getLatestRelease();
    if (!release)
      return NextResponse.json({ ok: false, error: "Нет файлов обновления" }, { status: 404, headers: NO_STORE });
    return NextResponse.json(
      { ok: true, ...release, url: `/api/overlay/download?file=${encodeURIComponent(release.file)}` },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("[overlay] Не удалось прочитать сведения об обновлении", error);
    return NextResponse.json(
      { ok: false, error: "Не удалось прочитать файлы обновления" },
      { status: 503, headers: NO_STORE },
    );
  }
}

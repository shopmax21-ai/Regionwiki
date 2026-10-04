import { type NextRequest, NextResponse } from "next/server";

import { loadImage } from "@/lib/jobs/images";

export const dynamic = "force-dynamic";

/** Отдаёт загруженную картинку гайда. Адрес зависит от содержимого файла, поэтому кеш вечный. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const image = await loadImage(id);
    if (!image) return new NextResponse("Not found", { status: 404 });

    return new NextResponse(new Uint8Array(image.data), {
      headers: {
        "Content-Type": image.mime,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    console.error("[jobs] Не удалось прочитать картинку", error);
    return new NextResponse("Unavailable", { status: 503 });
  }
}

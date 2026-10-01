import { NextResponse } from "next/server";

export const revalidate = 10800;

const sources = {
  general: "https://forum.region.game/forums/obshchiye-pravila-proyekta.43/",
  government: "https://forum.region.game/forums/pravila-gosudarstvennykh-organizatsii.3/",
};

export async function GET() {
  const results = await Promise.all(
    Object.entries(sources).map(async ([section, url]) => {
      const response = await fetch(url, { next: { revalidate: 10800 } });
      return { section, url, available: response.ok, checkedAt: new Date().toISOString() };
    }),
  );

  return NextResponse.json({ intervalHours: 3, sources: results });
}

import { NextRequest, NextResponse } from "next/server";
import { itunesSearch } from "@/lib/itunes";

export async function GET(req: NextRequest) {
  const term = req.nextUrl.searchParams.get("q")?.trim();
  if (!term) return NextResponse.json({ tracks: [] });
  try {
    const tracks = await itunesSearch(term, 20);
    return NextResponse.json({ tracks });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

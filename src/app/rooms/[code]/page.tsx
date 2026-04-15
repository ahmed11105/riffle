import { Suspense } from "react";
import { RoomGame } from "./RoomGame";

export default function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-10 text-center text-amber-100/70">Loading room…</div>}>
      <RoomLoader params={params} />
    </Suspense>
  );
}

async function RoomLoader({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomGame code={code.toUpperCase()} />;
}

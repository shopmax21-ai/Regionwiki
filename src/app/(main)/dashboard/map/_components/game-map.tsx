"use client";

const mapImageUrl =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_6771.png-VP4rwaUVI7NIvknGJK3ccdMb45NViV.jpeg";

interface GameMapProps {
  places?: unknown[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}

export default function GameMap(_props: GameMapProps) {
  return (
    <div className="relative size-full overflow-hidden bg-[#1d3033]">
      <img
        src={mapImageUrl}
        alt="Карта штата Region"
        className="size-full object-cover object-center"
        draggable={false}
      />
    </div>
  );
}

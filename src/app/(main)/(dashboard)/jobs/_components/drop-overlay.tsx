import { ImagePlus } from "lucide-react";

/** Подсказка поверх страницы, пока в окно тащат файл. */
export function DropOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background/70 p-6 backdrop-blur-[2px]"
    >
      <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-primary border-dashed bg-card px-10 py-8 text-center shadow-lg">
        <ImagePlus className="size-8 text-primary" />
        <p className="font-semibold text-lg">Отпустите, чтобы добавить картинку</p>
        <p className="text-muted-foreground text-sm">Бросьте на блок — она встанет после него</p>
      </div>
    </div>
  );
}

"use client";

import { createContext, type ReactElement, type ReactNode, useContext } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Куда выводить подсказки. В полноэкранном режиме браузер показывает только раздел карты, а обычный Tooltip
 * рисуется в body и пропал бы, поэтому раздел передаёт сюда себя.
 */
const TipContainerContext = createContext<HTMLElement | null>(null);

export const MapTipContainer = TipContainerContext.Provider;

type Side = "top" | "right" | "bottom" | "left";

/** Подсказка у элемента карты вместо стандартного title браузера. Внутри ровно один элемент: кнопка или ссылка. */
export function MapTip({ label, side = "top", children }: { label: ReactNode; side?: Side; children: ReactElement }) {
  const container = useContext(TipContainerContext);
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} container={container}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

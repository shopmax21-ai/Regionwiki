"use client";

import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FilterDropdownProps<T extends string> = {
  icon: LucideIcon;
  label: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
};

/** Кнопка с иконкой и выпадающим списком: фильтры и сортировка в одной строке с поиском. */
export function FilterDropdown<T extends string>({
  icon: Icon,
  label,
  value,
  options,
  onChange,
  className,
}: FilterDropdownProps<T>) {
  const current = options.find((option) => option.id === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label={label} className={`h-10 gap-2 px-3 ${className ?? ""}`}>
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          {current?.label ?? label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as T)}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

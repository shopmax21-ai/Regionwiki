"use client";

import type { ComponentType } from "react";

import {
  ArrowUpRight,
  BriefcaseBusiness,
  CarFront,
  FileText,
  HardHat,
  House,
  LayoutGrid,
  Map as MapIcon,
  Scale,
} from "lucide-react";

import { toSearchTerms } from "@/lib/search/terms";
import type { SearchKind } from "@/lib/search/types";

export const searchKindIcons: Record<SearchKind, ComponentType<{ className?: string }>> = {
  section: LayoutGrid,
  rule: Scale,
  job: HardHat,
  vehicle: CarFront,
  business: BriefcaseBusiness,
  realty: House,
  place: MapIcon,
};

export const SearchFallbackIcon = FileText;
export const SearchExternalIcon = ArrowUpRight;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Подсвечивает слова запроса; «е» и «ё» считаются одной буквой. */
export function SearchHighlight({ text, query }: { text: string; query: string }) {
  const terms = toSearchTerms(query).map((term) => escapeRegExp(term).replaceAll("е", "[её]"));
  if (terms.length === 0) return <>{text}</>;

  const parts = text.split(new RegExp(`(${terms.join("|")})`, "giu"));

  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: части строки статичны и не переставляются
          <mark key={index} className="rounded-sm bg-primary/20 px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: части строки статичны и не переставляются
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

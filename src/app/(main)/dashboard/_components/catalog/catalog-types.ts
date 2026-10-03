import type { ReactNode } from "react";

import type { LucideIcon } from "lucide-react";

export type CatalogDomain = "transport" | "items" | "property";
export type CatalogView = "grid" | "list";

export type PluralForms = [one: string, few: string, many: string];

export type SpecFieldType = "text" | "number" | "select" | "boolean" | "textarea" | "money";

export interface CatalogSpecField {
  key: string;
  label: string;
  type: SpecFieldType;
  unit?: string;
  options?: string[];
  placeholder?: string;
}

export interface CatalogDetailSection {
  id: string;
  title: string;
  fields: CatalogSpecField[];
  /** Для секций с денежными полями: подпись строки с суммой. */
  totalLabel?: string;
}

export interface CatalogKind {
  value: string;
  label: string;
  icon: LucideIcon;
}

export interface CatalogCategory {
  id: string;
  name: string;
  count: number;
  priceFrom: string;
  updatedAt: string;
}

export interface CatalogEntry {
  id: string;
  name: string;
  kind: string;
  price: string;
  owner: string;
  ownerInitials: string;
  modifiedAt: string;
  shared: boolean;
  starred: boolean;
  isNew?: boolean;
  details?: Record<string, string>;
}

export interface CatalogKindOption {
  value: string;
  label: string;
  icon: ReactNode;
}

export interface CatalogEntryDraft {
  name: string;
  kind: string;
  price: string;
  owner: string;
  shared: boolean;
  isNew: boolean;
  details: Record<string, string>;
}

export interface CatalogViewEntry extends CatalogEntry {
  kindLabel: string;
  icon: ReactNode;
}

export interface CatalogConfig {
  domain: CatalogDomain;
  basePath: string;
  metaTitle: string;
  metaDescription: string;
  title: string;
  subtitle: string;
  addLabel: string;
  addDialogTitle: string;
  addDialogDescription: string;
  namePlaceholder: string;
  defaultOwner: string;
  entryAddedMessage: string;
  newCategoryLabel: string;
  searchPlaceholder: string;
  categoriesTitle: string;
  categoriesEmptyTitle: string;
  categoriesEmptyDescription: string;
  allTitle: string;
  viewLabel: string;
  kindFilterLabel: string;
  ownerColumn: string;
  sharedLabel: string;
  entryForms: PluralForms;
  categoryForms: PluralForms;
  detailSections: CatalogDetailSection[];
  kinds: CatalogKind[];
  categories: CatalogCategory[];
  entries: CatalogEntry[];
}

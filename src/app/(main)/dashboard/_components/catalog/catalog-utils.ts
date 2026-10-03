import type { CatalogConfig, CatalogDetailSection, CatalogKind, CatalogSpecField, PluralForms } from "./catalog-types";

export function pluralize(count: number, forms: PluralForms) {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;

  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

export function getKind(config: CatalogConfig, kind: string): CatalogKind {
  return config.kinds.find((item) => item.value === kind) ?? config.kinds[0];
}

export function formatPrice(input: string) {
  const digits = input.replace(/\D/g, "");

  if (!digits) return "—";

  return `$${digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
}

export function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();

  return initials || "—";
}

export function defaultDetails(sections: CatalogDetailSection[]) {
  const details: Record<string, string> = {};

  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === "boolean") details[field.key] = "no";
      else if (field.type === "select") details[field.key] = field.options?.[0] ?? "";
      else details[field.key] = "";
    }
  }

  return details;
}

export function formatSpecValue(field: CatalogSpecField, value: string | undefined) {
  if (value === undefined) return "—";
  if (field.type === "boolean") return value === "yes" ? "Да" : "Нет";
  if (!value.trim()) return "—";
  if (field.type === "money") return formatPrice(value);
  if (field.type === "number" && field.unit) return `${value} ${field.unit}`;

  return value;
}

export function hasSpecValue(field: CatalogSpecField, value: string | undefined) {
  if (value === undefined) return false;
  return field.type === "boolean" || value.trim() !== "";
}

export function sumMoney(section: CatalogDetailSection, details: Record<string, string> | undefined) {
  return section.fields.reduce((total, field) => {
    if (field.type !== "money") return total;
    return total + (Number.parseInt(details?.[field.key] ?? "", 10) || 0);
  }, 0);
}

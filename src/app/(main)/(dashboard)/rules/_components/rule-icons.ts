import {
  Crown,
  FileText,
  HandCoins,
  House,
  Landmark,
  type LucideIcon,
  MapPin,
  MessagesSquare,
  PackageOpen,
  Plane,
  ScanSearch,
  ScrollText,
  ShieldCheck,
  Swords,
  Users,
} from "lucide-react";

/** Иконки разделов правил по slug. Для неизвестного раздела используется FileText. */
const ruleIcons: Record<string, LucideIcon> = {
  "obshchiye-pravila": ScrollText,
  "pravila-postavok-i-perekhvata": PackageOpen,
  "pravila-ograblenii-i-pokhishchenii": HandCoins,
  "pravila-semeinykh-organizatsii": Users,
  "pravila-voiny-za-vozdushnyi-gruz-vza": Plane,
  "pravila-dlya-liderov-fraktsii": Crown,
  "pravila-i-obyazannosti-administratsii": ShieldCheck,
  "pravila-napadeniya-na-voinskuyu-chast": Swords,
  "pravila-ob-igrovom-imushchestve": House,
  "pravila-igrovykh-zon": MapPin,
  "pravila-proverki-na-storonneye-po": ScanSearch,
  "pravila-foruma": MessagesSquare,
  "pravila-gosudarstvennykh-organizatsii": Landmark,
};

export function getRuleIcon(slug: string): LucideIcon {
  return ruleIcons[slug] ?? FileText;
}

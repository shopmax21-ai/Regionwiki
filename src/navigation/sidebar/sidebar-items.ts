import {
  BookOpen,
  BookText,
  BriefcaseBusiness,
  Calendar,
  CarFront,
  ClipboardCheck,
  Gavel,
  GraduationCap,
  HardHat,
  House,
  LayoutDashboard,
  ListChecks,
  Lock,
  type LucideIcon,
  Map as MapIcon,
  MessageSquareReply,
  Package,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

import { isPathVisible, type Viewer } from "@/lib/auth/protected-paths";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

/** Работа в меню: берётся из базы, поэтому добавленные и удалённые работы появляются и исчезают сами. */
export type JobNavLink = { slug: string; title: string };

function buildSidebarItems(jobLinks: readonly JobNavLink[]): NavGroup[] {
  return [
    {
      id: 1,
      label: "База знаний",
      items: [
        {
          id: "default",
          title: "Главная",
          url: "/",
          icon: LayoutDashboard,
        },
        {
          id: "transport",
          title: "Транспорт",
          url: "/transport",
          icon: CarFront,
        },
        {
          id: "items",
          title: "Предметы",
          url: "/items",
          icon: Package,
        },
        {
          id: "real-estate",
          title: "Недвижимость",
          url: "/real-estate",
          icon: House,
        },
        {
          id: "business",
          title: "Бизнесы",
          url: "/business",
          icon: BriefcaseBusiness,
        },
        {
          id: "jobs",
          title: "Работы",
          icon: HardHat,
          subItems: [
            { id: "jobs-all", title: "Всё о работах", url: "/jobs" },
            ...jobLinks.map((job) => ({ id: `job-${job.slug}`, title: job.title, url: `/jobs/${job.slug}` })),
          ],
        },
        {
          id: "map",
          title: "Карта",
          url: "/map",
          icon: MapIcon,
        },
      ],
    },
    {
      id: 2,
      label: "Правила",
      items: [
        {
          id: "general-rules",
          title: "Основные правила",
          url: "/rules/general",
          icon: BookOpen,
        },
        {
          id: "government-rules",
          title: "Правила госструктур",
          url: "/rules/government",
          icon: BookOpen,
        },
        {
          id: "rp-terms",
          title: "RP термины",
          url: "/rp-terms",
          icon: BookText,
        },
        {
          id: "rules-changelog",
          title: "История изменений",
          url: "/rules/changelog",
          icon: BookOpen,
        },
      ],
    },
    {
      id: 3,
      label: "Модерация",
      items: [
        {
          id: "punishments",
          title: "Заявка на наказание",
          url: "/punishments",
          icon: Gavel,
        },
        {
          id: "punishments-review",
          title: "Рассмотрение наказаний",
          url: "/punishments/review",
          icon: ShieldAlert,
        },
        {
          id: "punishments-all",
          title: "Все наказания",
          url: "/punishments/all",
          icon: ListChecks,
        },
        {
          id: "replies",
          title: "Быстрые ответы",
          url: "/replies",
          icon: MessageSquareReply,
        },
      ],
    },
    {
      id: 4,
      label: "Обучение",
      items: [
        {
          id: "academy",
          title: "Академия",
          url: "/academy",
          icon: GraduationCap,
        },
        {
          id: "academy-results",
          title: "Результаты тестов",
          url: "/academy/results",
          icon: ClipboardCheck,
        },
      ],
    },
    {
      id: 5,
      label: "Инструменты",
      items: [
        {
          id: "calendar",
          title: "Календарь",
          url: "/calendar",
          icon: Calendar,
        },
      ],
    },
    {
      id: 6,
      label: "Доступ и аккаунт",
      items: [
        {
          id: "profile",
          title: "Профиль",
          url: "/profile",
          icon: UserRound,
        },
        {
          id: "access",
          title: "Заявки на доступ",
          url: "/access",
          icon: ShieldCheck,
        },
        {
          id: "users",
          title: "Пользователи",
          url: "/users",
          icon: Users,
        },
        {
          id: "roles",
          title: "Роли и права",
          url: "/roles",
          icon: Lock,
        },
      ],
    },
  ];
}

/** Базовое меню без работ: нужно там, где важны только разделы (например, названия групп). */
export const sidebarItems: NavGroup[] = buildSidebarItems([]);

/** Пункты меню для текущего посетителя: закрытые разделы видят только вошедшие, а некоторые только администраторы. */
export function visibleSidebarItems(viewer: Viewer, jobLinks: readonly JobNavLink[] = []): NavGroup[] {
  return buildSidebarItems(jobLinks)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !("url" in item && item.url) || isPathVisible(item.url, viewer)),
    }))
    .filter((group) => group.items.length > 0);
}

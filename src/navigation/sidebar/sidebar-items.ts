import {
  Banknote,
  BookOpen,
  BookText,
  BriefcaseBusiness,
  Calendar,
  CarFront,
  ChartBar,
  CheckSquare,
  FolderOpen,
  Forklift,
  Gauge,
  GraduationCap,
  HardHat,
  House,
  Kanban,
  LayoutDashboard,
  ListTodo,
  Lock,
  type LucideIcon,
  Map as MapIcon,
  MessageSquare,
  MessageSquareReply,
  Package,
  Server,
  ShieldCheck,
  ShoppingBag,
  SquareArrowUpRight,
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
    label: "Дашборды",
    items: [
      {
        id: "default",
        title: "По умолчанию",
        url: "/dashboard/default",
        icon: LayoutDashboard,
      },
      {
        id: "crm",
        title: "CRM",
        url: "/dashboard/crm",
        icon: ChartBar,
      },
      {
        id: "finance",
        title: "Финансы",
        url: "/dashboard/finance",
        icon: Banknote,
      },
      {
        id: "analytics",
        title: "Аналитика",
        url: "/dashboard/analytics",
        icon: Gauge,
      },
      {
        id: "productivity",
        title: "Продуктивность",
        url: "/dashboard/productivity",
        icon: ListTodo,
      },
      {
        id: "ecommerce",
        title: "Электронная торговля",
        url: "/dashboard/ecommerce",
        icon: ShoppingBag,
      },
      {
        id: "academy",
        title: "Академия",
        url: "/dashboard/academy",
        icon: GraduationCap,
      },
      {
        id: "logistics",
        title: "Логистика",
        url: "/dashboard/logistics",
        icon: Forklift,
      },
      {
        id: "infrastructure",
        title: "Инфраструктура",
        url: "/dashboard/infrastructure",
        icon: Server,
      },
      {
        id: "file-manager",
        title: "Файлы",
        url: "/dashboard/file-manager",
        icon: FolderOpen,
      },
      {
        id: "transport",
        title: "Транспорт",
        url: "/dashboard/transport",
        icon: CarFront,
      },
      {
        id: "items",
        title: "Предметы",
        url: "/dashboard/items",
        icon: Package,
      },
      {
        id: "map",
        title: "Карта",
        url: "/dashboard/map",
        icon: MapIcon,
      },
      {
        id: "real-estate",
        title: "Недвижимость",
        url: "/dashboard/real-estate",
        icon: House,
      },
      {
        id: "business",
        title: "Бизнес",
        url: "/dashboard/business",
        icon: BriefcaseBusiness,
      },
      {
        id: "jobs",
        title: "Работы",
        icon: HardHat,
        subItems: [
          { id: "jobs-all", title: "Всё о работах", url: "/dashboard/jobs" },
          ...jobLinks.map((job) => ({ id: `job-${job.slug}`, title: job.title, url: `/dashboard/jobs/${job.slug}` })),
        ],
      },
    ],
  },
  {
    id: 2,
    label: "Страницы",
    items: [
      {
        id: "chat",
        title: "Чат",
        url: "/dashboard/chat",
        icon: MessageSquare,
      },
      {
        id: "calendar",
        title: "Календарь",
        url: "/dashboard/calendar",
        icon: Calendar,
      },
      {
        id: "kanban",
        title: "Канбан",
        url: "/dashboard/kanban",
        icon: Kanban,
      },
      {
        id: "tasks",
        title: "Задачи",
        url: "/dashboard/tasks",
        icon: CheckSquare,
      },
      {
        id: "profile",
        title: "Профиль",
        url: "/dashboard/profile",
        icon: UserRound,
      },
      {
        id: "users",
        title: "Пользователи",
        url: "/dashboard/users",
        icon: Users,
      },
      {
        id: "replies",
        title: "Быстрые ответы",
        url: "/dashboard/replies",
        icon: MessageSquareReply,
      },
      {
        id: "access",
        title: "Заявки на доступ",
        url: "/dashboard/access",
        icon: ShieldCheck,
      },
      {
        id: "roles",
        title: "Роли и права",
        url: "/dashboard/roles",
        icon: Lock,
      },
    ],
  },
  {
    id: 3,
    label: "Правила",
    items: [
      {
        id: "general-rules",
        title: "Основные правила",
        url: "/dashboard/rules/general",
        icon: BookOpen,
      },
      {
        id: "government-rules",
        title: "Государственных структур",
        url: "/dashboard/rules/government",
        icon: BookOpen,
      },
      {
        id: "rp-terms",
        title: "RP термины",
        url: "/dashboard/rp-terms",
        icon: BookText,
      },
      {
        id: "rules-changelog",
        title: "История изменений",
        url: "/dashboard/rules/changelog",
        icon: BookOpen,
      },
    ],
  },
  {
    id: 4,
    label: "Разное",
    items: [
      {
        id: "others",
        title: "Другое",
        url: "/dashboard/coming-soon",
        icon: SquareArrowUpRight,
        badge: "soon",
        disabled: true,
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

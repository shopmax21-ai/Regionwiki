import {
  BookOpen,
  BookText,
  BriefcaseBusiness,
  Calendar,
  CarFront,
  ChartBar,
  CheckSquare,
  ClipboardCheck,
  Gavel,
  GraduationCap,
  HardHat,
  House,
  Kanban,
  LayoutDashboard,
  ListChecks,
  Lock,
  Brain,
  type LucideIcon,
  Map as MapIcon,
  MessageSquare,
  MessageSquareReply,
  Package,
  ShieldAlert,
  ShieldCheck,
  SquareArrowUpRight,
  UserRound,
  Users,
  UsersRound,
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
          url: "/dashboard/default",
          icon: LayoutDashboard,
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
          id: "real-estate",
          title: "Недвижимость",
          url: "/dashboard/real-estate",
          icon: House,
        },
        {
          id: "business",
          title: "Бизнесы",
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
        {
          id: "map",
          title: "Карта",
          url: "/dashboard/map",
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
          url: "/dashboard/rules/general",
          icon: BookOpen,
        },
        {
          id: "government-rules",
          title: "Правила госструктур",
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
      id: 3,
      label: "Модерация",
      items: [
        {
          id: "punishments",
          title: "Заявка на наказание",
          url: "/dashboard/punishments",
          icon: Gavel,
        },
        {
          id: "punishments-review",
          title: "Рассмотрение наказаний",
          url: "/dashboard/punishments/review",
          icon: ShieldAlert,
        },
        {
          id: "punishments-all",
          title: "Все наказания",
          url: "/dashboard/punishments/all",
          icon: ListChecks,
        },
        {
          id: "replies",
          title: "Быстрые ответы",
          url: "/dashboard/replies",
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
          url: "/dashboard/academy",
          icon: GraduationCap,
        },
        {
          id: "academy-results",
          title: "Результаты тестов",
          url: "/dashboard/academy/results",
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
          url: "/dashboard/calendar",
          icon: Calendar,
        },
        {
          id: "tasks",
          title: "Задачи",
          url: "/dashboard/tasks",
          icon: CheckSquare,
        },
        {
          id: "kanban",
          title: "Канбан",
          url: "/dashboard/kanban",
          icon: Kanban,
        },
        {
          id: "chat",
          title: "Чат",
          url: "/dashboard/chat",
          icon: MessageSquare,
        },
        {
          id: "crm",
          title: "CRM",
          url: "/dashboard/crm",
          icon: ChartBar,
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
          url: "/dashboard/profile",
          icon: UserRound,
        },
        {
          id: "staff",
          title: "Администрация",
          url: "/dashboard/staff",
          icon: UsersRound,
        },
        {
          id: "access",
          title: "Заявки на доступ",
          url: "/dashboard/access",
          icon: ShieldCheck,
        },
        {
          id: "users",
          title: "Пользователи",
          url: "/dashboard/users",
          icon: Users,
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
      id: 7,
      label: "Разное",
      items: [
        {
          id:"ai",
          title: "AI Помощник",
          url: "/dashboard/ai-helper",
          icon: Brain,
          badge: "soon",
          disabled: true,
        },
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

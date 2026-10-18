import type { LucideIcon } from "lucide-react";

import {
  AcademyIcon,
  AccessIcon,
  AuditIcon,
  BugIcon,
  BusinessIcon,
  CalendarIcon,
  ChangelogIcon,
  CommandsIcon,
  GovernmentIcon,
  HomeIcon,
  ItemsIcon,
  JobsIcon,
  MapIcon,
  MediaIcon,
  MegaphoneIcon,
  OverlayIcon,
  PermissionsIcon,
  PunishmentIcon,
  PunishmentListIcon,
  RealEstateIcon,
  RepliesIcon,
  ReviewIcon,
  RulesIcon,
  StaffIcon,
  TermsIcon,
  TestResultsIcon,
  TransportIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons/region-icons";
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
          icon: HomeIcon,
        },
        {
          id: "transport",
          title: "Транспорт",
          url: "/transport",
          icon: TransportIcon,
        },
        {
          id: "items",
          title: "Предметы",
          url: "/items",
          icon: ItemsIcon,
        },
        {
          id: "real-estate",
          title: "Недвижимость",
          url: "/real-estate",
          icon: RealEstateIcon,
        },
        {
          id: "business",
          title: "Бизнесы",
          url: "/business",
          icon: BusinessIcon,
        },
        {
          id: "jobs",
          title: "Работы",
          icon: JobsIcon,
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
        {
          id: "media",
          title: "Медиа",
          url: "/media",
          icon: MediaIcon,
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
          icon: RulesIcon,
        },
        {
          id: "government-rules",
          title: "Правила госструктур",
          url: "/rules/government",
          icon: GovernmentIcon,
        },
        {
          id: "rp-terms",
          title: "RP термины",
          url: "/rp-terms",
          icon: TermsIcon,
        },
        {
          id: "rules-changelog",
          title: "История изменений",
          url: "/rules/changelog",
          icon: ChangelogIcon,
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
          icon: PunishmentIcon,
        },
        {
          id: "punishments-review",
          title: "Рассмотрение наказаний",
          url: "/punishments/review",
          icon: ReviewIcon,
        },
        {
          id: "punishments-all",
          title: "Все наказания",
          url: "/punishments/all",
          icon: PunishmentListIcon,
        },
        {
          id: "replies",
          title: "Быстрые ответы",
          url: "/replies",
          icon: RepliesIcon,
        },
        {
          id: "commands",
          title: "Команды сервера",
          url: "/commands",
          icon: CommandsIcon,
        },
        {
          id: "bugs",
          title: "Баг-репорты",
          url: "/bugs",
          icon: BugIcon,
        },
      ],
    },
    {
      id: 8,
      label: "Медиа",
      items: [
        {
          id: "media-pr",
          title: "Медиа PR",
          url: "/media-pr",
          icon: MegaphoneIcon,
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
          icon: AcademyIcon,
        },
        {
          id: "academy-results",
          title: "Результаты тестов",
          url: "/academy/results",
          icon: TestResultsIcon,
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
          icon: CalendarIcon,
        },
        {
          id: "overlay",
          title: "Оверлей для игры",
          url: "/overlay",
          icon: OverlayIcon,
          badge: "soon",
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
          icon: UserIcon,
        },
        {
          id: "access",
          title: "Заявки на доступ",
          url: "/access",
          icon: AccessIcon,
        },
        {
          id: "users",
          title: "Пользователи",
          url: "/users",
          icon: UsersIcon,
        },
        {
          id: "roles",
          title: "Роли и права",
          url: "/roles",
          icon: PermissionsIcon,
        },
      ],
    },
    {
      id: 7,
      label: "Администрация",
      items: [
        {
          id: "staff",
          title: "Администрация",
          url: "/staff",
          icon: StaffIcon,
        },
        {
          id: "audit",
          title: "Аудит действий",
          url: "/audit",
          icon: AuditIcon,
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

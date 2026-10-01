import {
  Banknote,
  BookOpen,
  BriefcaseBusiness,
  Calendar,
  CarFront,
  ChartBar,
  CheckSquare,
  Fingerprint,
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
  Mail,
  MessageSquare,
  ReceiptText,
  Server,
  ShoppingBag,
  SquareArrowUpRight,
  UserRound,
  Users,
} from "lucide-react";

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

export const sidebarItems: NavGroup[] = [
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
        url: "/dashboard/jobs",
        icon: HardHat,
      },
    ],
  },
  {
    id: 2,
    label: "Страницы",
    items: [
      {
        id: "email",
        title: "Почта",
        url: "/dashboard/mail",
        icon: Mail,
      },
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
        id: "invoice",
        title: "Счета",
        url: "/dashboard/invoice",
        icon: ReceiptText,
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
        id: "roles",
        title: "Роли",
        url: "/dashboard/roles",
        icon: Lock,
      },
      {
        id: "authentication",
        title: "Авторизация",
        icon: Fingerprint,
        subItems: [
          { id: "auth-login-v2", title: "Вход", url: "/auth/v2/login", newTab: true },
          { id: "auth-register-v2", title: "Регистрация", url: "/auth/v2/register", newTab: true },
        ],
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

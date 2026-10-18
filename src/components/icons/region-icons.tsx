import { forwardRef, type ReactNode } from "react";

import type { LucideIcon, LucideProps } from "lucide-react";

/**
 * Собственный набор иконок REGION: контур 1.75 со скруглёнными концами
 * и мягкая цветная заливка (currentColor, 20%) на главной детали.
 * Компоненты совместимы по типу с LucideIcon, поэтому ими можно заменять любые иконки без правок разметки.
 */
function createIcon(name: string, children: ReactNode): LucideIcon {
  const Icon = forwardRef<SVGSVGElement, LucideProps>(function RegionIcon(
    { size = 24, color = "currentColor", strokeWidth = 1.75, absoluteStrokeWidth, className, children: _c, ...rest },
    ref,
  ) {
    const width = absoluteStrokeWidth ? (Number(strokeWidth) * 24) / Number(size) : strokeWidth;
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...rest}
      >
        {children}
      </svg>
    );
  });
  Icon.displayName = name;
  return Icon as LucideIcon;
}

/** Мягкая заливка главной детали иконки. */
const tint = { fill: "currentColor", fillOpacity: 0.2, stroke: "none" } as const;

export const HomeIcon = createIcon(
  "HomeIcon",
  <>
    <rect x="3.5" y="3.5" width="7.5" height="10" rx="2" {...tint} />
    <rect x="3.5" y="3.5" width="7.5" height="10" rx="2" />
    <rect x="13" y="3.5" width="7.5" height="6" rx="2" />
    <rect x="13" y="11.5" width="7.5" height="9" rx="2" />
    <rect x="3.5" y="15.5" width="7.5" height="5" rx="2" />
  </>,
);

export const TransportIcon = createIcon(
  "TransportIcon",
  <>
    <path d="M5.2 12 6.6 8.2a1 1 0 0 1 .9-.7h9a1 1 0 0 1 .9.7L18.8 12Z" {...tint} />
    <path d="M5 17.5h-.5A1.5 1.5 0 0 1 3 16v-4l2.2-5.2A2 2 0 0 1 7 5.5h10a2 2 0 0 1 1.8 1.3L21 12v4a1.5 1.5 0 0 1-1.5 1.5H19" />
    <path d="M3 12h18" />
    <path d="M9 17.5h6" />
    <circle cx="7" cy="17.5" r="2" />
    <circle cx="17" cy="17.5" r="2" />
  </>,
);

export const ItemsIcon = createIcon(
  "ItemsIcon",
  <>
    <path d="M12 3 20 7.5 12 12 4 7.5Z" {...tint} />
    <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9Z" />
    <path d="M4 7.5 12 12l8-4.5" />
    <path d="M12 12v9" />
  </>,
);

export const RealEstateIcon = createIcon(
  "RealEstateIcon",
  <>
    <path d="M10 20v-5.5h4V20Z" {...tint} />
    <path d="M3.5 11 12 4l8.5 7" />
    <path d="M5.5 9.5V20h13V9.5" />
    <path d="M10 20v-5.5h4V20" />
  </>,
);

export const BusinessIcon = createIcon(
  "BusinessIcon",
  <>
    <rect x="10.5" y="11.5" width="3" height="3.5" rx="0.8" {...tint} />
    <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
    <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
    <path d="M3 13h18" />
    <rect x="10.5" y="11.5" width="3" height="3.5" rx="0.8" />
  </>,
);

export const JobsIcon = createIcon(
  "JobsIcon",
  <>
    <path d="M4 15.5a8 8 0 0 1 16 0Z" {...tint} />
    <path d="M4 15.5a8 8 0 0 1 16 0" />
    <rect x="2.5" y="15.5" width="19" height="3" rx="1.2" />
    <path d="M12 7.5v8" />
  </>,
);

export const MapIcon = createIcon(
  "MapIcon",
  <>
    <path d="M9 4.5 15 6.5v13l-6-2Z" {...tint} />
    <path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5Z" />
    <path d="M9 4.5v13" />
    <path d="M15 6.5v13" />
  </>,
);

export const MediaIcon = createIcon(
  "MediaIcon",
  <>
    <rect x="3" y="4.5" width="18" height="12" rx="2.5" {...tint} />
    <rect x="3" y="4.5" width="18" height="12" rx="2.5" />
    <path d="M10.2 8.6v3.8l3.3-1.9Z" />
    <path d="M8 20h8" />
    <path d="M12 16.5V20" />
  </>,
);

export const RulesIcon = createIcon(
  "RulesIcon",
  <>
    <path d="M15 3v6.5l-2-1.5-2 1.5V3Z" {...tint} />
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
    <path d="M4 20.5A2.5 2.5 0 0 0 6.5 21H20v-3" />
    <path d="M8.5 13h7" />
  </>,
);

export const GovernmentIcon = createIcon(
  "GovernmentIcon",
  <>
    <path d="M3.5 9.5 12 4l8.5 5.5Z" {...tint} />
    <path d="M3.5 9.5 12 4l8.5 5.5Z" />
    <path d="M6 12.5v5M10 12.5v5M14 12.5v5M18 12.5v5" />
    <path d="M3.5 20.5h17" />
  </>,
);

export const TermsIcon = createIcon(
  "TermsIcon",
  <>
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H9v18H6.5A1.5 1.5 0 0 1 5 19.5Z" {...tint} />
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v18H6.5A1.5 1.5 0 0 1 5 19.5Z" />
    <path d="M9 3v18" />
    <path d="M12.5 8h3.5M12.5 12h2.5" />
  </>,
);

export const ChangelogIcon = createIcon(
  "ChangelogIcon",
  <>
    <circle cx="12" cy="12" r="8" {...tint} />
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5" />
    <path d="M3.5 4v4.5H8" />
    <path d="M12 7.5V12l3 2" />
  </>,
);

export const PunishmentIcon = createIcon(
  "PunishmentIcon",
  <>
    <path d="M10.5 6 14 2.5 21.5 10 18 13.5Z" {...tint} />
    <path d="M10.5 6 14 2.5 21.5 10 18 13.5Z" />
    <path d="M14.5 9.5 4.5 19.5" />
    <path d="M3 21.5h9" />
  </>,
);

export const ReviewIcon = createIcon(
  "ReviewIcon",
  <>
    <path d="M12 3 19.5 6v5.5c0 4.6-3.1 8.1-7.5 9.5-4.4-1.4-7.5-4.9-7.5-9.5V6Z" {...tint} />
    <path d="M12 3 19.5 6v5.5c0 4.6-3.1 8.1-7.5 9.5-4.4-1.4-7.5-4.9-7.5-9.5V6Z" />
    <path d="M12 8.5v4" />
    <path d="M12 15.8h.01" />
  </>,
);

export const PunishmentListIcon = createIcon(
  "PunishmentListIcon",
  <>
    <rect x="11" y="4.5" width="10" height="3" rx="1.5" {...tint} />
    <path d="m3.5 6 1.7 1.7L8.5 4.3" />
    <path d="m3.5 12 1.7 1.7 3.3-3.4" />
    <path d="m3.5 18 1.7 1.7 3.3-3.4" />
    <path d="M12 6h8.5M12 12h8.5M12 18h8.5" />
  </>,
);

export const RepliesIcon = createIcon(
  "RepliesIcon",
  <>
    <path
      d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4 4v-4h-.5A2.5 2.5 0 0 1 4 13.5Z"
      {...tint}
    />
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4 4v-4h-.5A2.5 2.5 0 0 1 4 13.5Z" />
    <path d="M10.5 7.5 8 10l2.5 2.5" />
    <path d="M8 10h5a2 2 0 0 1 2 2" />
  </>,
);

export const CommandsIcon = createIcon(
  "CommandsIcon",
  <>
    <rect x="2.5" y="4.5" width="19" height="15" rx="3" {...tint} />
    <rect x="2.5" y="4.5" width="19" height="15" rx="3" />
    <path d="m7 9.5 3 2.5-3 2.5" />
    <path d="M12.5 15H17" />
  </>,
);

export const OverlayIcon = createIcon(
  "OverlayIcon",
  <>
    <rect x="2.5" y="4" width="19" height="13" rx="3" {...tint} />
    <rect x="2.5" y="4" width="19" height="13" rx="3" />
    <rect x="12" y="8" width="7" height="6" rx="1.5" />
    <path d="M8 20.5h8" />
    <path d="M12 17v3.5" />
  </>,
);

export const MegaphoneIcon = createIcon(
  "MegaphoneIcon",
  <>
    <path d="M3.5 10v4a1 1 0 0 0 1 1H7l9.5 4.5v-15L7 9H4.5a1 1 0 0 0-1 1Z" {...tint} />
    <path d="M3.5 10v4a1 1 0 0 0 1 1H7l9.5 4.5v-15L7 9H4.5a1 1 0 0 0-1 1Z" />
    <path d="m7 15 1.2 4.5h2.3L9.7 16.2" />
    <path d="M19.5 9.5a3.5 3.5 0 0 1 0 5" />
  </>,
);

export const BugIcon = createIcon(
  "BugIcon",
  <>
    <path d="M8 10a4 4 0 0 1 8 0v5a4 4 0 0 1-8 0Z" {...tint} />
    <path d="M8 10a4 4 0 0 1 8 0v5a4 4 0 0 1-8 0Z" />
    <path d="M12 11v8" />
    <path d="M9.5 6.5 8 4M14.5 6.5 16 4" />
    <path d="M3.5 8.5 8 10.5M3 14.5h5M4 20l4-2.5M20.5 8.5 16 10.5M21 14.5h-5M20 20l-4-2.5" />
  </>,
);

export const AcademyIcon = createIcon(
  "AcademyIcon",
  <>
    <path d="M12 4 2.5 9 12 14l9.5-5Z" {...tint} />
    <path d="M12 4 2.5 9 12 14l9.5-5Z" />
    <path d="M6.5 11.5v4.2c0 1.3 2.5 2.8 5.5 2.8s5.5-1.5 5.5-2.8v-4.2" />
    <path d="M21.5 9v6" />
  </>,
);

export const TestResultsIcon = createIcon(
  "TestResultsIcon",
  <>
    <rect x="8" y="3" width="8" height="4" rx="1.5" {...tint} />
    <path d="M8 5H6.5A2.5 2.5 0 0 0 4 7.5v11A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-11A2.5 2.5 0 0 0 17.5 5H16" />
    <rect x="8" y="3" width="8" height="4" rx="1.5" />
    <path d="m8.5 14 2.5 2.5 4.5-5" />
  </>,
);

export const CalendarIcon = createIcon(
  "CalendarIcon",
  <>
    <path d="M3.5 8.5a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3V10h-17Z" {...tint} />
    <rect x="3.5" y="5.5" width="17" height="15" rx="3" />
    <path d="M3.5 10h17" />
    <path d="M8 3v3.5M16 3v3.5" />
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.2h.01M12 17.2h.01" />
  </>,
);

export const UserIcon = createIcon(
  "UserIcon",
  <>
    <circle cx="12" cy="8" r="3.5" {...tint} />
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.6-3.6 3.3-5.5 7-5.5s6.4 1.9 7 5.5" />
  </>,
);

export const UsersIcon = createIcon(
  "UsersIcon",
  <>
    <circle cx="9" cy="8.5" r="3.2" {...tint} />
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3 19.5c.5-3.2 2.8-5 6-5s5.5 1.8 6 5" />
    <path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8" />
    <path d="M17 14.8c2.1.5 3.6 2.2 4 4.7" />
  </>,
);

export const AccessIcon = createIcon(
  "AccessIcon",
  <>
    <path d="M12 3 19.5 6v5.5c0 4.6-3.1 8.1-7.5 9.5-4.4-1.4-7.5-4.9-7.5-9.5V6Z" {...tint} />
    <path d="M12 3 19.5 6v5.5c0 4.6-3.1 8.1-7.5 9.5-4.4-1.4-7.5-4.9-7.5-9.5V6Z" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </>,
);

export const PermissionsIcon = createIcon(
  "PermissionsIcon",
  <>
    <rect x="4.5" y="10.5" width="15" height="10" rx="3" {...tint} />
    <rect x="4.5" y="10.5" width="15" height="10" rx="3" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    <path d="M12 14.5V17" />
  </>,
);

export const StaffIcon = createIcon(
  "StaffIcon",
  <>
    <circle cx="12" cy="10.8" r="2.2" {...tint} />
    <rect x="5" y="3.5" width="14" height="17" rx="3" />
    <path d="M10 6.5h4" />
    <circle cx="12" cy="10.8" r="2.2" />
    <path d="M8.5 17c.4-1.7 1.8-2.6 3.5-2.6s3.1.9 3.5 2.6" />
  </>,
);

export const AuditIcon = createIcon(
  "AuditIcon",
  <>
    <circle cx="16.5" cy="16" r="3.3" {...tint} />
    <path d="M13 21H7.5A2.5 2.5 0 0 1 5 18.5v-13A2.5 2.5 0 0 1 7.5 3H14l5 5v3" />
    <path d="M14 3v3.5A1.5 1.5 0 0 0 15.5 8H19" />
    <circle cx="16.5" cy="16" r="3.3" />
    <path d="m19 18.5 2 2" />
  </>,
);

/* Роли */

export const HelperRoleIcon = createIcon(
  "HelperRoleIcon",
  <>
    <circle cx="12" cy="12" r="3.5" {...tint} />
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="m6 6 3.5 3.5M14.5 14.5 18 18M18 6l-3.5 3.5M9.5 14.5 6 18" />
  </>,
);

export const JuniorRoleIcon = createIcon(
  "JuniorRoleIcon",
  <>
    <path d="M12 3 19.5 6v5.5c0 4.6-3.1 8.1-7.5 9.5-4.4-1.4-7.5-4.9-7.5-9.5V6Z" {...tint} />
    <path d="M12 3 19.5 6v5.5c0 4.6-3.1 8.1-7.5 9.5-4.4-1.4-7.5-4.9-7.5-9.5V6Z" />
    <path d="m8.8 13 3.2-3.2 3.2 3.2" />
  </>,
);

export const MediaRoleIcon = createIcon(
  "MediaRoleIcon",
  <>
    <path d="M3.5 9.5h17V18a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18Z" {...tint} />
    <path d="M3.5 9.5h17V18a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18Z" />
    <path d="M3.5 9.5V7a2.5 2.5 0 0 1 2.5-2.5h12A2.5 2.5 0 0 1 20.5 7v2.5" />
    <path d="M8.5 4.5 6.5 9.5M13.5 4.5l-2 5M18.5 4.5l-2 5" />
  </>,
);

export const AdminRoleIcon = createIcon(
  "AdminRoleIcon",
  <>
    <path d="M12 3 19.5 6v5.5c0 4.6-3.1 8.1-7.5 9.5-4.4-1.4-7.5-4.9-7.5-9.5V6Z" {...tint} />
    <path d="M12 3 19.5 6v5.5c0 4.6-3.1 8.1-7.5 9.5-4.4-1.4-7.5-4.9-7.5-9.5V6Z" />
    <path d="m12 8.5 1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.3-2.3 1.3.5-2.5-1.8-1.7 2.5-.3Z" />
  </>,
);

export const ChiefRoleIcon = createIcon(
  "ChiefRoleIcon",
  <>
    <path d="m3.5 8.5 4 3.5L12 5l4.5 7 4-3.5-1.8 10.5H5.3Z" {...tint} />
    <path d="m3.5 8.5 4 3.5L12 5l4.5 7 4-3.5-1.8 10.5H5.3Z" />
    <path d="M7 15.5h10" />
  </>,
);

/* Иконки карточки дня рождения */

export const BirthdayCakeIcon = createIcon(
  "BirthdayCakeIcon",
  <>
    <rect x="4" y="12" width="16" height="8.5" rx="2.2" {...tint} />
    <rect x="4" y="12" width="16" height="8.5" rx="2.2" />
    <path d="M4 16c1.8 1.4 3.2 1.4 4 0s2.2-1.4 4 0 3.2 1.4 4 0 2.2-1.4 4 0" />
    <path d="M8.5 12V9.2M12 12V8.2M15.5 12V9.2" />
    <path d="M8.5 7.2c-.6-.7-.6-1.4 0-2.2.6.8.6 1.5 0 2.2ZM12 6.2c-.6-.7-.6-1.4 0-2.2.6.8.6 1.5 0 2.2ZM15.5 7.2c-.6-.7-.6-1.4 0-2.2.6.8.6 1.5 0 2.2Z" />
  </>,
);

export const SaveDiskIcon = createIcon(
  "SaveDiskIcon",
  <>
    <path d="M5 3.5h10.5l4 4V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z" {...tint} />
    <path d="M5 3.5h10.5l4 4V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z" />
    <path d="M8 3.5V8h7V3.5" />
    <path d="M7.5 20.5v-6h9v6" />
  </>,
);

export const ClearDateIcon = createIcon(
  "ClearDateIcon",
  <>
    <circle cx="12" cy="12" r="8.5" {...tint} />
    <circle cx="12" cy="12" r="8.5" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </>,
);

export const DayPickIcon = createIcon(
  "DayPickIcon",
  <>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" {...tint} />
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M8 3v4M16 3v4M3.5 10h17" />
    <circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" />
  </>,
);

export const MonthPickIcon = createIcon(
  "MonthPickIcon",
  <>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" {...tint} />
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M8 3v4M16 3v4M3.5 10h17" />
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.2h.01M12 17.2h.01" strokeWidth="2.4" />
  </>,
);

export const CaretDownIcon = createIcon("CaretDownIcon", <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />);

export const CheckMarkIcon = createIcon("CheckMarkIcon", <path d="m5 12.5 4.5 4.5L19 7.5" />);

export const GiftBoxIcon = createIcon(
  "GiftBoxIcon",
  <>
    <rect x="4" y="10" width="16" height="10.5" rx="2" {...tint} />
    <rect x="4" y="10" width="16" height="10.5" rx="2" />
    <rect x="3" y="7" width="18" height="3.5" rx="1.4" />
    <path d="M12 7v13.5" />
    <path d="M12 7C9.5 7 8 6 8 4.8S9 3 10 3.2C11.4 3.5 12 5.5 12 7Zm0 0c2.5 0 4-1 4-2.2S15 3 14 3.2C12.6 3.5 12 5.5 12 7Z" />
  </>,
);

export const ConfettiIcon = createIcon(
  "ConfettiIcon",
  <>
    <path d="M4 20 8 8l8 8Z" {...tint} />
    <path d="M4 20 8 8l8 8Z" />
    <path d="M14 4v2M19 9h-2M17.5 5.5l-1.2 1.2M12 9.5c1.5-1 3-.5 3.5.8" />
    <path d="M19.5 14.5h.01M10.5 3.5h.01" strokeWidth="2.4" />
  </>,
);

export const SparkleIcon = createIcon(
  "SparkleIcon",
  <>
    <path
      d="M12 3.5c.6 4.4 2.1 5.9 6.5 6.5-4.4.6-5.9 2.1-6.5 6.5-.6-4.4-2.1-5.9-6.5-6.5 4.4-.6 5.9-2.1 6.5-6.5Z"
      {...tint}
    />
    <path d="M12 3.5c.6 4.4 2.1 5.9 6.5 6.5-4.4.6-5.9 2.1-6.5 6.5-.6-4.4-2.1-5.9-6.5-6.5 4.4-.6 5.9-2.1 6.5-6.5Z" />
    <path d="M19 16v4M17 18h4" />
  </>,
);

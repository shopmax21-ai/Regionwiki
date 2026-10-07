import { cn } from "cn";

import { PersonAvatar } from "@/components/person-avatar";
import { getInitials } from "@/lib/utils";

const GRADIENTS = [
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-fuchsia-400 to-purple-500",
  "from-violet-400 to-indigo-500",
  "from-sky-400 to-blue-500",
  "from-teal-400 to-emerald-500",
  "from-lime-400 to-green-500",
];

/** Один и тот же человек всегда получает один и тот же цвет */
function gradientFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

/**
 * Аватар в списках доступа. У администраторов настоящее фото из Telegram (сервер отдаёт только их),
 * у остальных инициалы на цветной подложке.
 */
export function AccessAvatar({
  id,
  name,
  admin,
  className,
}: {
  id: string;
  name: string;
  admin: boolean;
  className?: string;
}) {
  if (admin) return <PersonAvatar id={id} name={name} className={cn("size-11 rounded-xl text-sm", className)} />;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-11 shrink-0 select-none items-center justify-center rounded-xl bg-gradient-to-br font-semibold text-sm text-white shadow-sm",
        gradientFor(name),
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}

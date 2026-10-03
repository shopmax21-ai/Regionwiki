"use client";

import { type ComponentProps, type ReactNode, useState } from "react";

import { cn } from "cn";
import { Eye, EyeOff } from "lucide-react";

type AuthFieldProps = ComponentProps<"input"> & {
  icon: ReactNode;
  wrapperClassName?: string;
};

/** Поле ввода с иконкой слева; для type="password" добавляет «глазок». */
export function AuthField({ icon, type, className, wrapperClassName, ...props }: AuthFieldProps) {
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";

  return (
    <div className={cn("group relative", wrapperClassName)}>
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground [&_svg]:size-4">
        {icon}
      </span>
      <input
        {...props}
        type={isPassword && shown ? "text" : type}
        className={cn(
          "h-11 w-full rounded-lg bg-foreground/[0.07] pr-10 pl-10 text-foreground text-sm outline-none ring-1 ring-transparent transition placeholder:text-muted-foreground hover:bg-foreground/[0.09] focus-visible:ring-primary/60 aria-invalid:ring-destructive/60",
          className,
        )}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Скрыть пароль" : "Показать пароль"}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      )}
    </div>
  );
}

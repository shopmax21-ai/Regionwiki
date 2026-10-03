"use client";

import { useContext } from "react";

import { cn } from "cn";
import { OTPInput, OTPInputContext } from "input-otp";

export const CODE_LENGTH = 6;

/** Одна цифра — один слот. Состояние берём из контекста input-otp. */
function Slot({ index, invalid }: { index: number; invalid: boolean }) {
  const { slots } = useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = slots[index] ?? {};

  return (
    <div
      data-active={isActive}
      className={cn(
        "relative flex h-14 min-w-0 flex-1 items-center justify-center rounded-lg bg-foreground/[0.07] font-extrabold text-foreground text-xl tabular-nums ring-1 ring-transparent transition",
        "data-[active=true]:bg-foreground/[0.1] data-[active=true]:ring-2 data-[active=true]:ring-primary/70",
        char && !invalid && "ring-foreground/15",
        invalid && "ring-destructive/60",
      )}
    >
      {char}
      {hasFakeCaret && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="h-6 w-0.5 animate-caret-blink rounded bg-primary duration-1000" />
        </span>
      )}
    </div>
  );
}

export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  disabled: boolean;
  invalid: boolean;
}) {
  return (
    <OTPInput
      maxLength={CODE_LENGTH}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      inputMode="numeric"
      pattern="^[0-9]*$"
      autoComplete="one-time-code"
      disabled={disabled}
      aria-label="Код из Telegram"
      containerClassName={cn("flex gap-2 transition-opacity", disabled && "opacity-50")}
      render={({ slots }) => (
        <>
          {slots.map((slot, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: фиксированные 6 слотов
            <Slot key={i} index={i} invalid={invalid} />
          ))}
        </>
      )}
    />
  );
}

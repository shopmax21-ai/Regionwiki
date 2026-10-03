"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { toast } from "sonner";

import { authButtonClass } from "./auth-styles";

export function TelegramCodeForm() {
  const [code, setCode] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    toast("Код принят", {
      description: "Проверка кода будет подключена после настройки источника кодов.",
    });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-2 text-center text-muted-foreground text-xs" htmlFor="telegram-code">
        Код из Telegram
        <input
          id="telegram-code"
          className="h-12 rounded-lg border border-border bg-background px-4 text-center font-medium text-foreground text-lg tracking-[0.35em] outline-none transition placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-primary/60"
          inputMode="numeric"
          maxLength={6}
          name="code"
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          required
          value={code}
        />
      </label>
      <button className={authButtonClass} type="submit">
        Подтвердить код
      </button>
    </form>
  );
}

export default TelegramCodeForm;

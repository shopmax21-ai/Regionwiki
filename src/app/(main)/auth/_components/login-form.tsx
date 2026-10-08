"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ArrowLeft, CircleAlert, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { siTelegram } from "simple-icons";

import { SimpleIcon } from "@/components/simple-icon";

import { authButtonClass } from "./auth-styles";
import { CODE_LENGTH, CodeInput } from "./code-input";

type Step = "idle" | "bot";
type Linked = "waiting" | "code_sent";

const isTouchDevice = () => window.matchMedia("(pointer: coarse)").matches;

export function LoginForm({ next, disabled = false }: { next: string; disabled?: boolean }) {
  const [step, setStep] = useState<Step>("idle");
  const [link, setLink] = useState("");
  const [linked, setLinked] = useState<Linked>("waiting");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const verifying = useRef(false);

  const reset = useCallback((message: string | null = null) => {
    setStep("idle");
    setLink("");
    setLinked("waiting");
    setCode("");
    setError(message);
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/poll", { cache: "no-store" });
      const data = (await res.json()) as { state?: string; link?: string; message?: string };
      if (!res.ok && data.message) {
        setError(data.message);
        return;
      }
      if (data.state === "waiting" || data.state === "code_sent") {
        setLink((prev) => data.link ?? prev);
        setLinked(data.state);
        setStep("bot");
      } else if (data.state === "expired") {
        reset("Время вышло или закончились попытки. Начните вход заново.");
      }
    } catch {
      // Сеть моргнула: попробуем на следующем тике.
    }
  }, [reset]);

  // Вернулись на страницу (например, из Telegram на телефоне): подхватываем начатый вход.
  useEffect(() => {
    void poll();
  }, [poll]);

  useEffect(() => {
    if (step !== "bot") return;
    const timer = setInterval(() => void poll(), 2000);
    return () => clearInterval(timer);
  }, [step, poll]);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/start", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { link?: string; error?: string; message?: string };
      if (!res.ok || !data.link) {
        return setError(
          data.error === "too_many"
            ? "Слишком много попыток. Подождите минуту и попробуйте снова."
            : data.error === "config"
              ? "Вход через Telegram не настроен на сервере."
              : (data.message ?? "Не удалось начать вход. Попробуйте ещё раз."),
        );
      }
      setLink(data.link);
      setLinked("waiting");
      setCode("");
      setStep("bot");
      if (isTouchDevice()) window.location.assign(data.link);
    } catch {
      setError("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  const verify = useCallback(
    async (value: string) => {
      if (verifying.current) return;
      verifying.current = true;
      setPending(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: value, next }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
          status?: string;
          next?: string;
        };
        if (res.ok) {
          return window.location.assign(data.status === "approved" ? (data.next ?? next) : "/auth/v2/pending");
        }
        if (data.error === "expired") return reset("Код истёк или попытки закончились. Начните вход заново.");
        if (data.message) return setError(data.message);
        if (data.error === "config") return setError("Вход через Telegram не настроен на сервере.");
        setCode("");
        setError("Неверный код. Проверьте сообщение от бота и попробуйте снова.");
      } catch {
        setError("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.");
      } finally {
        verifying.current = false;
        setPending(false);
      }
    },
    [next, reset],
  );

  if (step === "idle") {
    return (
      <div className="flex flex-col gap-4">
        {error && <FormError>{error}</FormError>}
        <button type="button" onClick={start} disabled={disabled || pending} className={authButtonClass}>
          <SimpleIcon icon={siTelegram} className="size-4" />
          {pending ? "Открываем…" : "Войти через Telegram"}
        </button>
        <p className="text-center text-muted-foreground text-xs">
          Откроется бот Region WIKI. Нажмите Start, получите код и введите его здесь.
        </p>
      </div>
    );
  }

  const codeReady = linked === "code_sent";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 rounded-xl bg-foreground/[0.05] p-3">
        <div className="hidden shrink-0 rounded-lg bg-white p-2 sm:block [@media(max-height:680px)]:hidden">
          <QRCodeSVG value={link} size={92} level="M" marginSize={0} aria-label="QR-код для открытия бота" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm leading-snug">
            <span className="font-medium">1.</span> Откройте бота и нажмите <span className="font-medium">Start</span>
            <span className="hidden sm:inline [@media(max-height:680px)]:hidden"> или наведите камеру на QR-код</span>
          </p>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 font-extrabold text-primary-foreground text-xs uppercase tracking-wide transition hover:brightness-110"
          >
            Открыть бота <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm">
          <span className="font-medium">2.</span> Введите код из Telegram
        </p>
        <CodeInput
          value={code}
          onChange={setCode}
          onComplete={verify}
          disabled={!codeReady || pending}
          invalid={Boolean(error)}
        />
        <p className="flex items-center gap-2 text-muted-foreground text-xs" aria-live="polite">
          <span className="relative flex size-2">
            <span
              className={`absolute inline-flex size-full rounded-md ${codeReady ? "bg-emerald-500" : "animate-ping bg-primary/70"}`}
            />
            <span
              className={`relative inline-flex size-2 rounded-md ${codeReady ? "bg-emerald-500" : "bg-primary"}`}
            />
          </span>
          {codeReady ? "Код отправлен в Telegram. Он действует 5 минут." : "Ждём, пока вы нажмёте Start в боте…"}
        </p>
      </div>

      {error && <FormError>{error}</FormError>}

      <button
        type="button"
        disabled={!codeReady || pending || code.length < CODE_LENGTH}
        onClick={() => verify(code)}
        className={authButtonClass}
      >
        {pending ? "Проверяем…" : "Подтвердить"}
      </button>

      <button
        type="button"
        onClick={() => reset()}
        className="inline-flex items-center justify-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Начать заново
      </button>
    </div>
  );
}

function FormError({ children }: { children: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 text-destructive text-xs">
      <CircleAlert className="mt-px size-3.5 shrink-0" />
      {children}
    </p>
  );
}

import type { Metadata } from "next";

import { RegionLogo } from "../../_components/region-logo";
import TelegramCodeForm from "../../_components/telegram-code-form";

export const metadata: Metadata = {
  title: "Код Telegram | Region WIKI",
  description: "Подтверждение входа в Region WIKI кодом из Telegram.",
  robots: { index: false, follow: false },
};

export default function TelegramCodePage() {
  return (
    <>
      <div className="flex flex-col items-center gap-3 text-center">
        <RegionLogo />
        <h1 className="font-medium text-foreground/80 text-xs">Подтверждение входа</h1>
      </div>

      <p className="text-center text-muted-foreground text-sm">Введите код, который вы получили в Telegram.</p>

      <TelegramCodeForm />
    </>
  );
}

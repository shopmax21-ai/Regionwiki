import Link from "next/link";

import type { Metadata } from "next";

import { RegionLogo } from "../../_components/region-logo";
import { RegisterForm } from "../../_components/register-form";

export const metadata: Metadata = {
  title: "Регистрация | Region WIKI",
  description: "Создание аккаунта в Region WIKI.",
  alternates: {
    canonical: "/auth/v2/register",
  },
};

export default function RegisterV2() {
  return (
    <>
      <div className="flex flex-col items-center gap-3 text-center">
        <RegionLogo />
        <h1 className="font-medium text-foreground/80 text-xs">Регистрация в Region WIKI</h1>
      </div>

      <RegisterForm />

      <p className="text-center text-muted-foreground text-sm">
        Уже есть аккаунт?{" "}
        <Link prefetch={false} className="text-foreground hover:text-primary" href="login">
          Войти
        </Link>
      </p>
    </>
  );
}

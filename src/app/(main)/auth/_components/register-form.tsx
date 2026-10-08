"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Field, FieldError, FieldGroup } from "@/components/ui/field";

import { AuthField } from "./auth-field";
import { authButtonClass } from "./auth-styles";

const formSchema = z
  .object({
    email: z.email({ message: "Введите корректный email." }),
    password: z.string().min(6, { message: "Пароль должен быть не короче 6 символов." }),
    confirmPassword: z.string().min(6, { message: "Повторите пароль (минимум 6 символов)." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Пароли не совпадают.",
    path: ["confirmPassword"],
  });

function onSubmit(data: z.infer<typeof formSchema>) {
  toast("Данные формы (демо, без регистрации)", {
    description: (
      <pre className="mt-2 w-[320px] rounded-md bg-neutral-950 p-4">
        <code className="text-white">{JSON.stringify(data, null, 2)}</code>
      </pre>
    ),
  });
}

export function RegisterForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FieldGroup className="gap-3">
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <AuthField
                {...field}
                icon={<Mail />}
                type="email"
                placeholder="Email"
                aria-label="Email"
                autoComplete="email"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <AuthField
                {...field}
                icon={<Lock />}
                type="password"
                placeholder="Пароль"
                aria-label="Пароль"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="confirmPassword"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <AuthField
                {...field}
                icon={<Lock />}
                type="password"
                placeholder="Повторите пароль"
                aria-label="Повторите пароль"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
      <button type="submit" className={authButtonClass}>
        Продолжить
      </button>
    </form>
  );
}

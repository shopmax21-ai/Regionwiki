"use client";

import { useFormStatus } from "react-dom";

import { cn } from "cn";
import { Check, LoaderCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { decideAccess } from "../_actions";

function Submit({
  decision,
  size,
  className,
}: {
  decision: "approved" | "rejected";
  size: "sm" | "default";
  className?: string;
}) {
  const { pending, data } = useFormStatus();
  // Крутится только та кнопка, которую нажали
  const mine = pending && data?.get("decision") === decision;
  const approve = decision === "approved";
  return (
    <Button
      type="submit"
      name="decision"
      value={decision}
      size={size}
      disabled={pending}
      variant={approve ? "default" : "outline"}
      className={cn(!approve && "hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive", className)}
    >
      {mine ? <LoaderCircle className="animate-spin" /> : approve ? <Check /> : <X />}
      {approve ? "Одобрить" : "Отклонить"}
    </Button>
  );
}

/** Кнопки решения по заявке. `only` оставляет одну из двух. */
export function DecisionButtons({
  telegramId,
  only,
  size = "sm",
  stretch = false,
}: {
  telegramId: string;
  only?: "approved" | "rejected";
  size?: "sm" | "default";
  /** Кнопки делят всю ширину карточки */
  stretch?: boolean;
}) {
  return (
    <form action={decideAccess} className={cn("flex shrink-0 gap-2", stretch && "w-full")}>
      <input type="hidden" name="telegramId" value={telegramId} />
      {only !== "approved" && <Submit decision="rejected" size={size} className={stretch ? "flex-1" : undefined} />}
      {only !== "rejected" && <Submit decision="approved" size={size} className={stretch ? "flex-1" : undefined} />}
    </form>
  );
}

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttemptSummary } from "@/lib/academy/types";

import { AttemptsTable } from "./attempts-table";

/**
 * Личный блок администратора: результаты всех тестов, которые он проходил.
 * Показывает только итог. Правильность ответов и разбор видят Главные администраторы в разделе «Результаты тестов».
 */
export function MyResults({ attempts }: { attempts: AttemptSummary[] }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>Мои результаты</CardTitle>
        <CardDescription>Все тесты, которые вы проходили: баллы и итог по каждому.</CardDescription>
      </CardHeader>
      <AttemptsTable attempts={attempts} emptyText="Вы ещё не проходили тесты. Выберите любой выше." />
    </Card>
  );
}

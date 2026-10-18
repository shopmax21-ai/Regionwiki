import type { Metadata } from "next";

import { listTests } from "@/lib/academy/store";
import type { AcademyTest, TestCardData } from "@/lib/academy/types";
import { requirePageAdmin } from "@/lib/auth/admin";

import { QuizCenter } from "./_components/quiz-center";

export const metadata: Metadata = {
  title: "Тесты | Академия",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const toCard = (test: AcademyTest): TestCardData => ({
  id: test.id,
  title: test.title,
  description: test.description,
  category: test.category,
  difficulty: test.difficulty,
  durationMin: test.durationMin,
  passPercent: test.passPercent,
  kind: test.kind,
  questionCount: test.kind === "rules" ? (test.rules?.questionCount ?? 0) : test.questions.length,
  closed: test.closed,
});

export default async function Page() {
  const admin = await requirePageAdmin();
  const canEdit = admin.permissions.includes("academy.edit");
  const canSeeResults = admin.permissions.includes("academy.results");

  let tests: AcademyTest[] = [];
  let problem: string | null = null;

  try {
    const loadedTests = await listTests();
    // Закрытые тесты в общем списке видят только те, кто их редактирует и выдаёт на них ссылки
    tests = canEdit ? loadedTests : loadedTests.filter((test) => !test.closed);
  } catch (error) {
    console.error("[academy] Не удалось загрузить Академию", error);
    problem = "база данных недоступна";
  }

  return (
    <QuizCenter
      cards={tests.map(toCard)}
      // Правильные ответы уходят в браузер только тем, кто может редактировать тесты
      editable={canEdit ? tests : null}
      canSeeResults={canSeeResults}
      problem={problem}
    />
  );
}

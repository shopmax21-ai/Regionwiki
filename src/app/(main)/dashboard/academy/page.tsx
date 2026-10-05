import type { Metadata } from "next";

import { getUserStats, listAttempts, listTests } from "@/lib/academy/store";
import type { AcademyTest, TestCardData } from "@/lib/academy/types";
import { requireAdmin } from "@/lib/auth/admin";

import { MyResults } from "./_components/my-results";
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
});

export default async function Page() {
  const admin = await requireAdmin();
  const canEdit = admin.permissions.includes("academy.edit");
  const canSeeResults = admin.permissions.includes("academy.results");

  let tests: AcademyTest[] = [];
  let problem: string | null = null;
  let myAttempts: Awaited<ReturnType<typeof listAttempts>> = [];
  let stats = { attempts: 0, averagePercent: 0, bestPercent: 0 };

  try {
    const [loadedTests, loadedStats, loadedAttempts] = await Promise.all([
      listTests(),
      getUserStats(admin.id, 0),
      listAttempts({ userId: admin.id, limit: 50 }),
    ]);
    tests = loadedTests;
    stats = loadedStats;
    myAttempts = loadedAttempts;
  } catch (error) {
    console.error("[academy] Не удалось загрузить Академию", error);
    problem = "база данных недоступна";
  }

  return (
    <QuizCenter
      cards={tests.map(toCard)}
      // Правильные ответы уходят в браузер только тем, кто может редактировать тесты
      editable={canEdit ? tests : null}
      kpis={stats}
      canSeeResults={canSeeResults}
      problem={problem}
    >
      <MyResults attempts={myAttempts} />
    </QuizCenter>
  );
}

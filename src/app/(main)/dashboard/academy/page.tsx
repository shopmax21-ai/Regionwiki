import type { Metadata } from "next";

import { QuizCenter } from "./_components/quiz-center";

export const metadata: Metadata = {
  title: "Тесты | Академия",
  description: "Выберите тест по проекту и проверьте свои знания.",
  alternates: {
    canonical: "/dashboard/academy",
  },
};

export default function Page() {
  return <QuizCenter />;
}

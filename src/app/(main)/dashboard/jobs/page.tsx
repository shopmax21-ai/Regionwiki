import type { Metadata } from "next";

import { JobsHub } from "@/app/(main)/dashboard/jobs/_components/jobs-hub";

export const metadata: Metadata = {
  title: "Всё о работах | Region WIKI",
  description: "Гайды по всем работам штата: условия доступа, процесс, советы и путь прокачки.",
};

export default function Page() {
  return <JobsHub />;
}

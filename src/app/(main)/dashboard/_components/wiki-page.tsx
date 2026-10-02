"use client";

import { useMemo, useState } from "react";

import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CarFront,
  ChevronRight,
  CircleHelp,
  FileText,
  Search,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const sections = [
  {
    title: "Начало игры",
    description: "Всё, что нужно знать перед первым входом на сервер",
    icon: Sparkles,
    count: 12,
  },
  {
    title: "Основные правила",
    description: "Общие правила проекта, игровые ситуации и ответственность",
    icon: Shield,
    count: 12,
    href: "https://forum.region.game/forums/obshchiye-pravila-proyekta.43/",
  },
  {
    title: "Государственные структуры",
    description: "Правила государственных организаций и фракционной игры",
    icon: Users,
    count: 1,
    href: "https://forum.region.game/forums/pravila-gosudarstvennykh-organizatsii.3/",
  },
  {
    title: "Работы и бизнес",
    description: "Как зарабатывать, открывать бизнес и развиваться",
    icon: BriefcaseBusiness,
    count: 31,
  },
  { title: "Транспорт", description: "Автомобили, лицензии, тюнинг и дорожные правила", icon: CarFront, count: 16 },
  { title: "Города и места", description: "Карта штата, важные локации и полезные адреса", icon: Building2, count: 27 },
];

const ruleGroups = [
  {
    title: "Основные правила",
    description: "Общие правила проекта и специальные игровые ситуации",
    href: "https://forum.region.game/forums/obshchiye-pravila-proyekta.43/",
    topics: [
      "Общие правила",
      "Правила поставок и перехвата",
      "Правила ограблений и похищений",
      "Правила семейных организаций",
      "Правила войны за воздушный груз (ВЗА)",
      "Правила для лидеров фракций",
      "Правила и обязанности администрации",
      "Правила нападения на воинскую часть",
      "Правила об игровом имуществе",
      "Правила игровых зон",
      "Правила проверки на стороннее ПО",
      "Правила форума",
    ],
  },
  {
    title: "Государственные структуры",
    description: "Правила государственных организаций",
    href: "https://forum.region.game/forums/pravila-gosudarstvennykh-organizatsii.3/",
    topics: ["Правила государственных организаций"],
  },
];

const popularArticles = ruleGroups.flatMap((group) =>
  group.topics.slice(0, group.title === "Основные правила" ? 3 : 1).map((topic) => [
    topic,
    "Официальный форум",
    group.title,
    group.href,
  ]),
);

export function WikiPage() {
  const [query, setQuery] = useState("");
  const filteredSections = useMemo(
    () =>
      sections.filter((section) =>
        `${section.title} ${section.description}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 pb-10">
      <section className="relative overflow-hidden rounded-3xl border bg-card px-6 py-10 shadow-sm md:px-10 md:py-14">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative max-w-2xl">
          <Badge variant="secondary" className="mb-5 gap-2 rounded-full px-3 py-1">
            <Sparkles className="size-3.5" /> Region Wiki
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Добро пожаловать в штат Region</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
            База знаний для игроков. Найдите ответы, изучите правила и начните свою историю в новом городе.
          </p>
          <div className="relative mt-8 max-w-xl">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Что вы хотите найти?"
              aria-label="Поиск по wiki"
              className="h-14 rounded-2xl bg-background pl-12 pr-4 text-base shadow-sm"
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Популярное: правила, старт, фракции, лицензии</p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Исследуйте Region</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Разделы wiki</h2>
          </div>
          <span className="text-sm text-muted-foreground">{filteredSections.length} разделов</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSections.map((section) => {
            const Icon = section.icon;
            const content = (
              <Card className="group cursor-pointer transition-colors hover:border-primary/50">
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <CardDescription className="mt-2 leading-6">{section.description}</CardDescription>
                  <p className="mt-5 text-xs font-medium text-muted-foreground">{section.count} статей</p>
                </CardContent>
              </Card>
            );

            return section.href ? (
              <a key={section.title} href={section.href} target="_blank" rel="noreferrer">
                {content}
              </a>
            ) : (
              <div key={section.title}>{content}</div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                <BookOpen className="size-5" />
              </div>
              <div>
                <CardTitle>Популярные статьи</CardTitle>
                <CardDescription>Чаще всего читают игроки Region</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {popularArticles.map(([title, time, category, href]) => (
              <a
                key={title}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-4 rounded-xl border border-transparent p-3 text-left transition-colors hover:border-border hover:bg-muted/50"
              >
                <FileText className="size-5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {category} · {time}
                  </span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </a>
            ))}
          </CardContent>
        </Card>
        <Card className="bg-primary text-primary-foreground">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/15">
              <CircleHelp className="size-5" />
            </div>
            <CardTitle className="mt-4">Не нашли ответ?</CardTitle>
            <CardDescription className="text-primary-foreground/75">
              Задайте вопрос сообществу Region или обратитесь в поддержку.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button type="button" className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
              Перейти в поддержку <ArrowRight className="size-4" />
            </button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

export default WikiPage;

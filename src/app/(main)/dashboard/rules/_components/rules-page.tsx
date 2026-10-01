"use client";

import { useMemo, useState } from "react";

import { ArrowUpRight, Clock3, FileText, RefreshCw, Search, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { changelog, type RuleSection, rules, syncInfo } from "./rules-data";

export function RulesPage({ section }: { section: RuleSection }) {
  const data = rules[section];
  const [query, setQuery] = useState("");
  const articles = useMemo(
    () => data.articles.filter((article) => article.title.toLowerCase().includes(query.toLowerCase())),
    [data.articles, query],
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10">
      <section className="rounded-3xl border bg-card px-6 py-8 shadow-sm md:px-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <Badge variant="secondary" className="mb-4 gap-2 rounded-full px-3 py-1">
              <ShieldCheck className="size-3.5" /> Синхронизировано с форумом
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">{data.description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs text-muted-foreground">
            <RefreshCw className="size-4 text-primary" /> {syncInfo.interval}
          </div>
        </div>
        <div className="relative mt-7 max-w-xl">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти правило"
            className="pl-9"
            aria-label="Поиск правил"
          />
        </div>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Разделы правил</CardTitle>
              <CardDescription className="mt-1">{articles.length} материалов из официального источника</CardDescription>
            </div>
            <Badge variant="outline">Актуально</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          {articles.map((article, index) => (
            <a
              key={article.title}
              href={article.source}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/50 hover:bg-muted/40"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-medium text-primary">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{article.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">Обновлено {article.updatedAt}</span>
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Источник</CardTitle>
            <CardDescription>Открыть оригинальную публикацию на форуме</CardDescription>
          </CardHeader>
          <CardContent>
            <a
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              href={data.source}
              target="_blank"
              rel="noreferrer"
            >
              Перейти на форум <ArrowUpRight className="size-4" />
            </a>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Автообновление</CardTitle>
            <CardDescription>Сервис проверяет изменения автоматически</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Clock3 className="size-4" /> Следующая проверка по расписанию
            </span>
            <span className="flex items-center gap-2">
              <FileText className="size-4" /> Последняя: {syncInfo.lastChecked}
            </span>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export function ChangelogPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10">
      <section>
        <Badge variant="secondary" className="mb-4 gap-2 rounded-full">
          <RefreshCw className="size-3.5" /> Автоматическая синхронизация
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">История изменений</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Изменения правил, обнаруженные на официальном форуме Region.
        </p>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Журнал обновлений</CardTitle>
          <CardDescription>Проверка источников выполняется каждые 3 часа</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {changelog.map((item) => (
            <div
              key={`${item.date}-${item.title}`}
              className="flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center"
            >
              <Badge variant="outline" className="w-fit">
                {item.date}
              </Badge>
              <span className="flex-1 text-sm font-medium">{item.title}</span>
              <span className="text-xs text-muted-foreground">{item.section}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}

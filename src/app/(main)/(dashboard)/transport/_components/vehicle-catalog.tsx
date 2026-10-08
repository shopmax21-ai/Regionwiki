"use client";

import { useMemo, useState } from "react";

import { CarFront, ChevronDown, Gauge, Search, SlidersHorizontal, Sparkles, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const categories = [
  "Все",
  "Легковые",
  "Грузовые",
  "Мототехника",
  "Велосипеды",
  "Вертолеты",
  "Самолеты",
  "Водный транспорт",
];
const vehicles = [
  {
    name: "Superior",
    model: "90G",
    type: "Легковые",
    speed: 290,
    fast: 325,
    price: "$17 000 000",
    tag: "Majestic Премиум",
    tone: "from-amber-950 via-zinc-900 to-slate-950",
    accent: "text-amber-300",
  },
  {
    name: "Merlin",
    model: "Boat Tayl",
    type: "Водный транспорт",
    speed: 300,
    fast: 335,
    price: "$20 000 000",
    tag: "Majestic Премиум",
    tone: "from-cyan-950 via-slate-900 to-zinc-950",
    accent: "text-cyan-300",
  },
  {
    name: "Molsheim",
    model: "Brouillurd",
    type: "Легковые",
    speed: 340,
    fast: 375,
    price: "$29 000 000",
    tag: "Осенний кейс 2026",
    tone: "from-violet-950 via-zinc-900 to-slate-950",
    accent: "text-violet-300",
  },
  {
    name: "Freightways",
    model: "Cuscadia II",
    type: "Грузовые",
    speed: 135,
    fast: 170,
    price: "$20 000 000",
    tag: "Осенний кейс 2026",
    tone: "from-emerald-950 via-zinc-900 to-slate-950",
    accent: "text-emerald-300",
  },
  {
    name: "Dewbauchee",
    model: "Champion",
    type: "Легковые",
    speed: 245,
    fast: 280,
    price: "$8 500 000",
    tag: "Стандарт",
    tone: "from-rose-950 via-zinc-900 to-slate-950",
    accent: "text-rose-300",
  },
  {
    name: "Nagasaki",
    model: "Shinobi",
    type: "Мототехника",
    speed: 265,
    fast: 300,
    price: "$6 200 000",
    tag: "Стандарт",
    tone: "from-blue-950 via-zinc-900 to-slate-950",
    accent: "text-blue-300",
  },
];

export function VehicleCatalog() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Все");
  const [sort, setSort] = useState("new");
  const filtered = useMemo(() => {
    const result = vehicles.filter((vehicle) => {
      const matchesQuery = `${vehicle.name} ${vehicle.model}`.toLowerCase().includes(query.toLowerCase());
      return matchesQuery && (category === "Все" || vehicle.type === category);
    });
    return [...result].sort((a, b) =>
      sort === "speed"
        ? b.speed - a.speed
        : sort === "price"
          ? Number(b.price.replace(/\D/g, "")) - Number(a.price.replace(/\D/g, ""))
          : 0,
    );
  }, [category, query, sort]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <section className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <CarFront className="size-4" /> Region Wiki / Транспорт
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Таблица транспорта</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Каталог автомобилей, техники и транспорта штата с характеристиками и актуальной стоимостью.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit gap-2 rounded-md px-3 py-1.5">
          <Sparkles className="size-3.5" /> {vehicles.length} моделей
        </Badge>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск транспорта..."
              aria-label="Поиск транспорта" data-section-search
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            className="justify-between lg:w-44"
            onClick={() => setSort(sort === "new" ? "speed" : sort === "speed" ? "price" : "new")}
          >
            <SlidersHorizontal data-icon="inline-start" />
            {sort === "new" ? "Сначала новые" : sort === "speed" ? "По скорости" : "По цене"}
            <ChevronDown data-icon="inline-end" />
          </Button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Категории транспорта">
          {categories.map((item) => (
            <Button
              key={item}
              role="tab"
              aria-selected={category === item}
              variant={category === item ? "default" : "outline"}
              size="sm"
              className="shrink-0 rounded-full"
              onClick={() => setCategory(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((vehicle) => (
          <VehicleCard key={`${vehicle.name}-${vehicle.model}`} vehicle={vehicle} />
        ))}
      </div>
      {!filtered.length && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <CarFront className="size-8 text-muted-foreground" />
            <p className="font-medium">Ничего не найдено</p>
            <p className="text-sm text-muted-foreground">Измените запрос или выберите другую категорию.</p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

type Vehicle = (typeof vehicles)[number];

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  return (
    <Card className="group overflow-hidden transition-colors hover:border-primary/60">
      <div
        className={`relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br ${vehicle.tone}`}
      >
        <div className="absolute -right-8 -top-10 size-40 rounded-md border border-white/10" />
        <div className="absolute -bottom-16 -left-8 size-48 rounded-md border border-white/10" />
        <CarFront
          className={`relative size-24 stroke-[1.1] opacity-90 transition-transform group-hover:scale-110 ${vehicle.accent}`}
        />
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge className="bg-background/80 text-foreground backdrop-blur">Новый</Badge>
          <Badge variant="outline" className="border-white/20 bg-black/20 text-white">
            <Zap className="mr-1 size-3" />
            Нитро
          </Badge>
        </div>
      </div>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">
              {vehicle.name} <span className="font-normal text-muted-foreground">{vehicle.model}</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{vehicle.tag}</p>
          </div>
          <Badge variant="outline">{vehicle.type}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 border-y py-3 text-xs">
          <div>
            <p className="text-muted-foreground">Скорость</p>
            <p className="mt-1 font-medium">
              {vehicle.speed} <span className="font-normal text-muted-foreground">км/ч</span>
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Макс. с FT</p>
            <p className="mt-1 font-medium">
              {vehicle.fast} <span className="font-normal text-muted-foreground">км/ч</span>
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Вес</p>
            <p className="mt-1 font-medium">
              {vehicle.type === "Грузовые" ? "2 400" : "1 260"}{" "}
              <span className="font-normal text-muted-foreground">кг</span>
            </p>
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Гос. стоимость</p>
            <p className="mt-1 text-lg font-semibold">{vehicle.price}</p>
          </div>
          <Button size="sm" variant="outline">
            <Gauge data-icon="inline-start" />
            Подробнее
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

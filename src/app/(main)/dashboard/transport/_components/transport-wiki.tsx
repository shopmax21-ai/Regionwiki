"use client";

import { useMemo, useState } from "react";

import {
  ArrowUpDown,
  Bike,
  CarFront,
  ChevronDown,
  CircleDollarSign,
  ExternalLink,
  Filter,
  Gauge,
  Grid2X2,
  List,
  Search,
  Ship,
  Sparkles,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const categories = [
  "Все",
  "Легковые",
  "Грузовые",
  "Мототехника",
  "Велосипеды",
  "Вертолеты",
  "Самолеты",
  "Водный транспорт",
] as const;
type Category = (typeof categories)[number];

type Vehicle = {
  name: string;
  model: string;
  category: Exclude<Category, "Все">;
  speed: number;
  tunedSpeed: number;
  price: number;
  source: string;
  code: string;
  premium?: boolean;
  new?: boolean;
  nitro?: boolean;
};

const vehicles: Vehicle[] = [
  {
    name: "Superior",
    model: "90G",
    category: "Легковые",
    speed: 290,
    tunedSpeed: 325,
    price: 17000000,
    source: "Majestic Премиум",
    code: "genesisg90",
    premium: true,
    new: true,
    nitro: true,
  },
  {
    name: "Merlin",
    model: "Boat Tayl",
    category: "Водный транспорт",
    speed: 300,
    tunedSpeed: 335,
    price: 20000000,
    source: "Majestic Премиум",
    code: "boattail",
    premium: true,
    new: true,
    nitro: true,
  },
  {
    name: "Molsheim",
    model: "Brouillurd",
    category: "Легковые",
    speed: 340,
    tunedSpeed: 375,
    price: 29000000,
    source: "Осенний кейс 2026",
    code: "brouillard",
    premium: true,
    new: true,
    nitro: true,
  },
  {
    name: "Freightways",
    model: "Cuscadia II",
    category: "Грузовые",
    speed: 135,
    tunedSpeed: 170,
    price: 20000000,
    source: "Осенний кейс 2026",
    code: "cascadia",
    premium: true,
    new: true,
  },
  {
    name: "Bravado",
    model: "Banshee 900R",
    category: "Легковые",
    speed: 265,
    tunedSpeed: 302,
    price: 8500000,
    source: "Автосалон",
    code: "banshee",
    nitro: true,
  },
  {
    name: "Nagasaki",
    model: "Shotaro",
    category: "Мототехника",
    speed: 285,
    tunedSpeed: 320,
    price: 12000000,
    source: "Автосалон",
    code: "shotaro",
    premium: true,
    nitro: true,
  },
  {
    name: "Pegassi",
    model: "Zentorno",
    category: "Легковые",
    speed: 275,
    tunedSpeed: 310,
    price: 9200000,
    source: "Автосалон",
    code: "zentorno",
    nitro: true,
  },
  {
    name: "BMX",
    model: "BMX",
    category: "Велосипеды",
    speed: 45,
    tunedSpeed: 55,
    price: 15000,
    source: "Магазин",
    code: "bmx",
  },
];

const categoryIcons = {
  Легковые: CarFront,
  Грузовые: Truck,
  Мототехника: Bike,
  Велосипеды: Bike,
  Вертолеты: Gauge,
  Самолеты: Gauge,
  "Водный транспорт": Ship,
};
const formatPrice = (price: number) => `$${price.toLocaleString("ru-RU")}`;

export function TransportWiki() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("Все");
  const [sort, setSort] = useState<"new" | "price">("new");
  const [view, setView] = useState<"list" | "grid">("list");

  const filteredVehicles = useMemo(
    () =>
      vehicles
        .filter((vehicle) => {
          const matchesCategory = category === "Все" || vehicle.category === category;
          const haystack = `${vehicle.name} ${vehicle.model} ${vehicle.code}`.toLowerCase();
          return matchesCategory && haystack.includes(query.toLowerCase());
        })
        .sort((a, b) => (sort === "price" ? b.price - a.price : Number(b.new) - Number(a.new))),
    [category, query, sort],
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-7 pb-10">
      <header className="flex flex-col items-center gap-3 py-4 text-center md:py-7">
        <Badge variant="secondary" className="gap-2 rounded-full px-3 py-1">
          <Sparkles data-icon="inline-start" /> Region Wiki
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Таблица транспорта</h1>
        <p className="max-w-xl text-sm text-muted-foreground md:text-base">
          Подробные характеристики автомобилей и другой техники в штате
        </p>
      </header>

      <section className="flex flex-col gap-3" aria-label="Фильтры транспорта">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск транспорта..."
              aria-label="Поиск транспорта"
              className="h-12 rounded-xl pl-11"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-12 gap-2">
              <Filter data-icon="inline-start" />
              Фильтры
            </Button>
            <Button variant="outline" className="h-12 gap-2" onClick={() => setSort(sort === "new" ? "price" : "new")}>
              <CircleDollarSign data-icon="inline-start" />
              {sort === "new" ? "Все" : "По цене"}
              <ChevronDown data-icon="inline-end" />
            </Button>
            <Button variant="outline" className="h-12 gap-2" onClick={() => setSort(sort === "new" ? "price" : "new")}>
              <ArrowUpDown data-icon="inline-start" />
              {sort === "new" ? "Сначала новые" : "Сначала дорогие"}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2">
            {categories.map((item) => (
              <Button
                key={item}
                size="sm"
                variant={category === item ? "default" : "outline"}
                onClick={() => setCategory(item)}
              >
                {item}
              </Button>
            ))}
          </div>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(value) => value && setView(value as "list" | "grid")}
            variant="outline"
            size="sm"
            className="ml-auto shrink-0"
            aria-label="Вид каталога"
          >
            <ToggleGroupItem value="list" aria-label="Список">
              <List />
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Сетка">
              <Grid2X2 />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </section>

      <div className={view === "grid" ? "grid gap-4 md:grid-cols-2" : "flex flex-col gap-3"}>
        {filteredVehicles.map((vehicle) => {
          const Icon = categoryIcons[vehicle.category];
          return (
            <Card
              key={vehicle.code}
              className="group overflow-hidden border-border/70 bg-card transition-colors hover:border-primary/60"
            >
              <CardContent className="p-0">
                <div className="relative flex h-56 items-start justify-between overflow-hidden bg-muted/40 p-4 sm:h-64">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-background/80" />
                  <div className="pointer-events-none absolute -bottom-20 left-1/2 flex size-72 -translate-x-1/2 items-center justify-center rounded-full bg-primary/10 blur-3xl" />
                  <div className="relative z-10 flex flex-wrap gap-2">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-background/80 text-muted-foreground backdrop-blur-sm">
                      <Icon />
                    </div>
                    {vehicle.new && <Badge>Новый</Badge>}
                  </div>
                  <div className="relative z-10 flex flex-col items-end gap-2">
                    {vehicle.nitro && (
                      <Badge variant="outline" className="bg-background/70 backdrop-blur-sm">
                        Нитро
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="bg-background/70 backdrop-blur-sm"
                      aria-label={`Открыть ${vehicle.name} ${vehicle.model}`}
                    >
                      <ExternalLink />
                    </Button>
                  </div>
                  <Icon className="absolute bottom-3 left-1/2 size-36 -translate-x-1/2 text-primary/20 transition-transform duration-300 group-hover:scale-110" />
                </div>
                <div className="flex flex-col gap-4 p-4 sm:p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{vehicle.name}</p>
                    <h2 className="text-xl font-semibold tracking-tight">{vehicle.model}</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-3 border-t pt-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Скорость</p>
                      <p className="mt-1 font-semibold">{vehicle.speed} км/ч</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Максимальная скорость (FT)</p>
                      <p className="mt-1 font-semibold">{vehicle.tunedSpeed} км/ч</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Гос. стоимость</p>
                      <p className="mt-1 font-semibold">{formatPrice(vehicle.price)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md bg-muted px-2 py-1">{vehicle.source}</span>
                    <span className="rounded-md bg-muted px-2 py-1">ID {vehicle.code}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {!filteredVehicles.length && (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Транспорт не найден
        </div>
      )}
      <p className="text-center text-sm text-muted-foreground">
        Показано {filteredVehicles.length} из {vehicles.length} единиц транспорта
      </p>
    </main>
  );
}

import type { ReactNode } from "react";

import Link from "next/link";

import { ArrowLeft, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  formatPrice,
  formatTrunk,
  getScrapPrice,
  paintGroups,
  type Vehicle,
  type VehicleUpgrade,
  vehicleTitle,
} from "../_data/vehicles";
import { VehicleImage } from "./vehicle-image";
import { VehiclePlates } from "./vehicle-plates";

const yesNo = (value: boolean) => (value ? "Да" : "Нет");

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <Card>
        <CardHeader>
          <CardTitle id={id} className="text-lg">
            {title}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  );
}

function SpecTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col-reverse justify-end gap-1 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-lg leading-tight font-semibold break-words">{value}</dd>
    </div>
  );
}

function UpgradeRow({ upgrade }: { upgrade: VehicleUpgrade }) {
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-medium">{upgrade.name}</h3>
          <p className="text-sm text-muted-foreground">{upgrade.description}</p>
        </div>
        <span className="shrink-0 font-semibold">+{formatPrice(upgrade.total)}</span>
      </div>

      {upgrade.levels?.map((item) => (
        <div
          key={item.level}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm"
        >
          <span>Уровень {item.level}</span>
          <span className="flex items-center gap-3">
            {item.bonus && <Badge variant="secondary">{item.bonus}</Badge>}
            <span className="font-medium">{formatPrice(item.price)}</span>
          </span>
        </div>
      ))}

      {upgrade.options?.map((option) => (
        <div
          key={option.name}
          className="flex items-start justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <p className="font-medium">{option.name}</p>
            <p className="text-muted-foreground">{option.description}</p>
          </div>
          <span className="flex shrink-0 items-center gap-3">
            <Badge variant="secondary">{option.value}</Badge>
            <span className="font-medium">+{formatPrice(option.price)}</span>
          </span>
        </div>
      ))}
    </li>
  );
}

export function VehicleDetails({ vehicle }: { vehicle: Vehicle }) {
  const upgradesTotal = vehicle.upgrades?.reduce((sum, item) => sum + item.total, 0) ?? 0;
  const wheelsTotal = vehicle.wheels?.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const paints = paintGroups.filter((group) => group.types.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/transport"
          className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Вернуться к списку
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{vehicleTitle(vehicle)}</h1>
      </div>

      <Card className="gap-0 py-0">
        <div className="relative">
          <VehicleImage
            vehicle={vehicle}
            priority
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="aspect-[4/3] sm:aspect-[16/9]"
            imageClassName="p-6 sm:p-10"
          />
          <div className="absolute top-4 left-4 flex flex-wrap gap-1.5">
            <Badge variant="outline" className="bg-background/80 backdrop-blur">
              {vehicle.category}
            </Badge>
            {vehicle.isNew && <Badge>Новый</Badge>}
            {vehicle.nitro && (
              <Badge variant="secondary">
                <Zap data-icon="inline-start" /> Нитро
              </Badge>
            )}
          </div>
        </div>
      </Card>

      <section aria-label="Характеристики">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <SpecTile label="Гос. стоимость" value={formatPrice(vehicle.price)} />
          <SpecTile label="Стоимость свалки" value={formatPrice(getScrapPrice(vehicle))} />
          <SpecTile label="Максимальная скорость" value={`${vehicle.speed} км/ч`} />
          <SpecTile label="Максимальная скорость (FT)" value={`${vehicle.tunedSpeed} км/ч`} />
          <SpecTile label="Возможность передачи" value={yesNo(vehicle.transferable)} />
          <SpecTile label="Вместимость багажника" value={formatTrunk(vehicle)} />
          <SpecTile label="Тип топлива" value={vehicle.fuel} />
          <SpecTile label="Дрифт-чип" value={yesNo(vehicle.driftChip)} />
          <SpecTile label="Нитро" value={yesNo(vehicle.nitro)} />
          <SpecTile label="Уникальный ID" value={<code className="font-mono text-base">{vehicle.code}</code>} />
        </dl>
      </section>

      <Section id="sources" title="Источники получения" description="Где можно получить данный транспорт">
        <ul className="flex flex-wrap gap-2">
          {vehicle.sources.map((source) => (
            <li key={source}>
              <Badge variant="secondary" className="h-7 px-3 text-sm">
                {source}
              </Badge>
            </li>
          ))}
        </ul>
      </Section>

      {vehicle.upgrades && vehicle.upgrades.length > 0 && (
        <Section id="upgrades" title="Улучшения транспорта" description="Стоимость улучшений до максимального уровня">
          <ul className="divide-y">
            {vehicle.upgrades.map((upgrade) => (
              <UpgradeRow key={upgrade.name} upgrade={upgrade} />
            ))}
          </ul>
          <div className="mt-5 flex flex-col gap-1 border-t pt-4">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium">Стоимость улучшений</span>
              <span className="text-lg font-semibold">{formatPrice(upgradesTotal)}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Итоговая стоимость может отличаться из-за комиссии тюнинг-салона на вашем сервере
            </p>
          </div>
        </Section>
      )}

      {vehicle.wheels && vehicle.wheels.length > 0 && (
        <Section id="wheels" title="Доступные колеса" description={`Всего доступно ${wheelsTotal} колес для установки`}>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {vehicle.wheels.map((wheel) => (
              <li key={wheel.type} className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-3">
                <span className="text-sm text-muted-foreground">{wheel.type}</span>
                <span className="text-lg font-semibold">{wheel.count} шт.</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {vehicle.plates && vehicle.plates.length > 0 && (
        <Section
          id="plates"
          title="Номерные знаки"
          description={`Всего доступно ${vehicle.plates.length} дизайнов номерных знаков`}
        >
          <VehiclePlates plates={vehicle.plates} />
        </Section>
      )}

      {paints.length > 0 && (
        <Section id="paint" title="Покраска транспорта" description="Доступные типы и виды покраски">
          <div className="flex flex-col gap-5">
            {paints.map((group) => (
              <div key={group.name} className="flex flex-col gap-2">
                <h3 className="font-medium">{group.name}</h3>
                <ul className="flex flex-wrap gap-2">
                  {group.types.map((type) => (
                    <li key={type}>
                      <Badge variant="outline" className="h-6 px-2.5 text-sm">
                        {type}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}
    </main>
  );
}

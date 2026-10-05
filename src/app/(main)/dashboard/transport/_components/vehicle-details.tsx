import type { ReactNode } from "react";

import Link from "next/link";

import {
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  Fuel,
  Gauge,
  Hash,
  type LucideIcon,
  Package,
  Recycle,
  Rocket,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { formatPrice, formatTrunk, getScrapPrice, type Vehicle, vehicleTitle } from "../_data/vehicles";
import { VehicleDelete } from "./vehicle-delete";
import { VehicleEditor } from "./vehicle-editor";
import { VehicleImage } from "./vehicle-image";
import { VehiclePaint } from "./vehicle-paint";
import { VehicleTuning } from "./vehicle-tuning";

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

function SpecTile({ label, value, icon: Icon }: { label: string; value: ReactNode; icon: LucideIcon }) {
  return (
    <div className="relative flex flex-col-reverse justify-end gap-1 overflow-hidden rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <Icon
        className="pointer-events-none absolute right-2.5 bottom-2.5 size-12 stroke-[1.25] text-foreground/10"
        aria-hidden="true"
      />
      <dt className="relative text-sm text-muted-foreground">{label}</dt>
      <dd className="relative text-lg leading-tight font-semibold break-words">{value}</dd>
    </div>
  );
}

export function VehicleDetails({ vehicle, canEdit = false }: { vehicle: Vehicle; canEdit?: boolean }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/transport"
          className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Вернуться к списку
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{vehicleTitle(vehicle)}</h1>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <VehicleEditor mode="edit" vehicle={vehicle} />
              <VehicleDelete code={vehicle.code} title={vehicleTitle(vehicle)} />
            </div>
          )}
        </div>
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
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <SpecTile icon={Banknote} label="Гос. стоимость" value={formatPrice(vehicle.price)} />
          <SpecTile icon={Recycle} label="Стоимость свалки" value={formatPrice(getScrapPrice(vehicle))} />
          <SpecTile icon={Gauge} label="Максимальная скорость" value={`${vehicle.speed} км/ч`} />
          <SpecTile icon={Rocket} label="Максимальная скорость (FT)" value={`${vehicle.tunedSpeed} км/ч`} />
          <SpecTile icon={ArrowLeftRight} label="Возможность передачи" value={yesNo(vehicle.transferable)} />
          <SpecTile icon={Package} label="Вместимость багажника" value={formatTrunk(vehicle)} />
          <SpecTile icon={Fuel} label="Тип топлива" value={vehicle.fuel} />
          <SpecTile
            icon={Hash}
            label="Уникальный ID"
            value={<code className="font-mono text-base">{vehicle.code}</code>}
          />
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
        <Section
          id="upgrades"
          title="Улучшения транспорта"
          description="Добавляйте и убирайте уровни, чтобы рассчитать стоимость тюнинга"
        >
          <VehicleTuning upgrades={vehicle.upgrades} />
        </Section>
      )}

      <Section id="paint" title="Покраска транспорта" description="Доступные цвета">
        <VehiclePaint />
      </Section>
    </main>
  );
}

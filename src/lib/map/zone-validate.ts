import { z } from "zod";

import { isInsideWorld } from "@/app/(main)/(dashboard)/map/_components/map-data";
import {
  ZONE_LIMITS,
  type ZoneColorId,
  type ZonePoint,
  zoneColorIds,
} from "@/app/(main)/(dashboard)/map/_components/zone-data";

export const zoneSchema = z.object({
  name: z.string().trim().min(1, "Укажите название").max(ZONE_LIMITS.name, "Название слишком длинное"),
  color: z.enum(zoneColorIds, { error: "Выберите цвет" }),
  description: z.string().trim().max(ZONE_LIMITS.description, "Описание слишком длинное").default(""),
  points: z
    .array(z.object({ x: z.number({ error: "Неверная точка" }), y: z.number({ error: "Неверная точка" }) }))
    .min(ZONE_LIMITS.minPoints, `Поставьте на карте не меньше ${ZONE_LIMITS.minPoints} точек`)
    .max(ZONE_LIMITS.maxPoints, `В зоне не может быть больше ${ZONE_LIMITS.maxPoints} точек`),
});

export type ZoneInput = {
  name: string;
  color: ZoneColorId;
  description: string;
  points: ZonePoint[];
};

export function validateZone(input: unknown): { ok: true; zone: ZoneInput } | { ok: false; error: string } {
  const result = zoneSchema.safeParse(input);
  if (!result.success) return { ok: false, error: result.error.issues[0]?.message ?? "Проверьте заполнение формы" };
  const zone = result.data;
  if (!zone.points.every(isInsideWorld)) return { ok: false, error: "Все точки зоны должны быть в пределах карты" };
  // Координаты храним с точностью до сотых, как у меток
  const points = zone.points.map((point) => ({
    x: Math.round(point.x * 100) / 100,
    y: Math.round(point.y * 100) / 100,
  }));
  return { ok: true, zone: { ...zone, points } };
}

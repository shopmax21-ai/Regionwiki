import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { hasPermission } from "@/lib/auth/admin";
import { getVehicleByCode } from "@/lib/vehicles/store";

import { VehicleDetails } from "../_components/vehicle-details";
import { vehicleTitle } from "../_data/vehicles";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const { vehicle } = await getVehicleByCode(code);

  if (!vehicle) return { title: "Транспорт не найден | Region WIKI" };

  return {
    title: `${vehicleTitle(vehicle)} | Транспорт | Region WIKI`,
    description: `${vehicleTitle(vehicle)}: характеристики, стоимость, улучшения и покраска.`,
  };
}

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [{ vehicle, editable }, admin] = await Promise.all([getVehicleByCode(code), hasPermission("transport.edit")]);

  if (!vehicle) notFound();

  return <VehicleDetails vehicle={vehicle} canEdit={admin && editable} />;
}

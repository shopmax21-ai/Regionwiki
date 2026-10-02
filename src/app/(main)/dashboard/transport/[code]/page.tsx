import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { VehicleDetails } from "../_components/vehicle-details";
import { getVehicle, vehicles, vehicleTitle } from "../_data/vehicles";

export const dynamicParams = false;

export function generateStaticParams() {
  return vehicles.map((vehicle) => ({ code: vehicle.code }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const vehicle = getVehicle(code);

  if (!vehicle) return { title: "Транспорт не найден | Region WIKI" };

  return {
    title: `${vehicleTitle(vehicle)} | Транспорт | Region WIKI`,
    description: `${vehicleTitle(vehicle)}: характеристики, стоимость, улучшения и покраска.`,
  };
}

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const vehicle = getVehicle(code);

  if (!vehicle) notFound();

  return <VehicleDetails vehicle={vehicle} />;
}

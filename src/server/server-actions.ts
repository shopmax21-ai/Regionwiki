"use server";

import { cookies } from "next/headers";

import {
  getPreferencePersistence,
  PREFERENCE_REGISTRY,
  type PreferenceKey,
  type PreferenceValueMap,
  parsePreference,
} from "@/lib/preferences/preferences-config";

const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Сохраняет только настройки оформления из реестра и только допустимые значения: произвольные cookie через это действие ставить нельзя. */
export async function setValueToCookie(key: string, value: string): Promise<void> {
  if (!Object.hasOwn(PREFERENCE_REGISTRY, key)) return;
  const preference = key as PreferenceKey;
  if (!(PREFERENCE_REGISTRY[preference].values as readonly string[]).includes(value)) return;

  const cookieStore = await cookies();
  cookieStore.set(preference, value, {
    path: "/",
    maxAge: PREFERENCE_COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getPreference<K extends PreferenceKey>(key: K): Promise<PreferenceValueMap[K]> {
  const definition = PREFERENCE_REGISTRY[key];
  const persistence = getPreferencePersistence(key);

  if (persistence !== "client-cookie" && persistence !== "server-cookie") {
    return definition.defaultValue as PreferenceValueMap[K];
  }

  const cookieStore = await cookies();
  return parsePreference(key, cookieStore.get(key)?.value.trim());
}

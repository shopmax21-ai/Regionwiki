import {
  type Business,
  businessCode,
  businesses as seedBusinesses,
} from "@/app/(main)/dashboard/business/_data/businesses";
import { createJsonStore, RecordStoreError } from "@/lib/db/json-store";

export { RecordStoreError as BusinessStoreError };

const store = createJsonStore<Business>({
  table: "businesses",
  lockId: 727_002,
  seed: seedBusinesses,
  keyOf: businessCode,
  tag: "businesses",
});

export const getBusinessesVersion = store.version;

export async function listBusinesses(): Promise<{ businesses: Business[]; editable: boolean }> {
  const { items, editable } = await store.list();
  return { businesses: items, editable };
}

export const createBusiness = store.create;
export const updateBusiness = store.update;
export const deleteBusiness = store.remove;

import { type Realty, realties as seedRealties } from "@/app/(main)/dashboard/real-estate/_data/realties";
import { createJsonStore, RecordStoreError } from "@/lib/db/json-store";

export { RecordStoreError as RealtyStoreError };

const store = createJsonStore<Realty>({
  table: "realties",
  lockId: 727_003,
  seed: seedRealties,
  keyOf: (realty) => String(realty.id),
  tag: "realties",
});

export const getRealtiesVersion = store.version;

export async function listRealties(): Promise<{ realties: Realty[]; editable: boolean }> {
  const { items, editable } = await store.list();
  return { realties: items, editable };
}

export const createRealty = store.create;
export const updateRealty = store.update;
export const deleteRealty = store.remove;

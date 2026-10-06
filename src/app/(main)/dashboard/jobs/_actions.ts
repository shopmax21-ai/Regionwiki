"use server";

import { revalidatePath } from "next/cache";

import type { MapPlace } from "@/app/(main)/dashboard/map/_components/map-data";
import { actorOf, recordContentChange } from "@/lib/audit/store";
import { getAdmin } from "@/lib/auth/admin";
import { createJob, deleteJob, JobStoreError, listJobs, updateJob } from "@/lib/jobs/store";
import { validateJob } from "@/lib/jobs/validate";
import { listMapPlaces } from "@/lib/map/store";

export type JobActionResult = { ok: true; slug: string } | { ok: false; error: string };

const DENIED: JobActionResult = { ok: false, error: "Недостаточно прав для редактирования работ" };

function failure(error: unknown): JobActionResult {
  if (error instanceof JobStoreError) {
    if (error.code === "not_found") return { ok: false, error: "Работа не найдена, возможно, её уже удалили" };
    if (error.code === "exists") return { ok: false, error: "Работа с таким адресом уже есть, выберите другой адрес" };
  }
  console.error("[jobs] Не удалось сохранить изменения", error);
  return { ok: false, error: "База данных недоступна, попробуйте позже" };
}

// Сайдбар живёт в общем layout дашборда, поэтому сбрасываем кеш от него, а не только от /dashboard/jobs:
// иначе добавленная или удалённая работа не появится и не исчезнет в меню до перезагрузки страницы.
const refresh = () => revalidatePath("/dashboard", "layout");

const badSlug = (slug: unknown) => typeof slug !== "string" || slug.length === 0 || slug.length > 64;

/** Добавить работу. Нужно право «Редактирование работ и гайдов», оно проверяется по базе. */
export async function createJobAction(input: unknown): Promise<JobActionResult> {
  const admin = await getAdmin("jobs.edit");
  if (!admin) return DENIED;

  const result = validateJob(input);
  if (!result.ok) return result;

  try {
    await createJob(result.job, admin.id);
    await recordContentChange(actorOf(admin), "job", "created", { id: result.job.slug, label: result.job.title });
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true, slug: result.job.slug };
}

export async function updateJobAction(slug: string, input: unknown): Promise<JobActionResult> {
  const admin = await getAdmin("jobs.edit");
  if (!admin) return DENIED;
  if (badSlug(slug)) return { ok: false, error: "Неизвестная работа" };

  const result = validateJob(input);
  if (!result.ok) return result;
  // Работа не может ссылаться сама на себя
  const job = { ...result.job, altRanks: result.job.altRanks.filter((item) => item !== slug) };

  try {
    await updateJob(slug, job, admin.id);
    await recordContentChange(actorOf(admin), "job", "updated", { id: slug, label: job.title });
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true, slug };
}

export async function deleteJobAction(slug: string): Promise<JobActionResult> {
  const admin = await getAdmin("jobs.edit");
  if (!admin) return DENIED;
  if (badSlug(slug)) return { ok: false, error: "Неизвестная работа" };

  try {
    const title = await listJobs()
      .then(({ jobs }) => jobs.find((job) => job.slug === slug)?.title)
      .catch(() => undefined);
    await deleteJob(slug, admin.id);
    await recordContentChange(actorOf(admin), "job", "deleted", { id: slug, label: title ?? slug });
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true, slug };
}

export type MapPlacesResult = { ok: true; places: MapPlace[] } | { ok: false; error: string };

/** Метки общей карты штата: из них редактор гайда берёт места для блока «Карта». Нужно то же право, что и для правки гайдов. */
export async function listMapPlacesForGuideAction(): Promise<MapPlacesResult> {
  const admin = await getAdmin("jobs.edit");
  if (!admin) return { ok: false, error: "Недостаточно прав для редактирования работ" };
  const { places } = await listMapPlaces();
  return { ok: true, places };
}

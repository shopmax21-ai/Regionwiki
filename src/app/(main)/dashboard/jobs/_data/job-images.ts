/**
 * Картинки работ. Чтобы заменить картинку — выполните любой из вариантов:
 *  1. Положите свой файл в public/images/jobs/ под тем же именем (например shahter.svg) — ничего менять в коде не нужно;
 *  2. Положите файл с другим именем/расширением (shahter.webp, .jpg, .png) и поправьте путь здесь;
 *  3. Укажите внешний URL (https://...).
 * Если для работы нет записи — показывается заглушка с иконкой.
 * Рекомендуемый размер: 16:9, например 1280×720.
 */
const dir = "/images/jobs";

export const jobImages: Record<string, string> = {
  shahter: `${dir}/shahter.svg`,
  stroitel: `${dir}/stroitel.svg`,
  sobiratel: `${dir}/sobiratel.svg`,
  povar: `${dir}/povar.svg`,
  rybak: `${dir}/rybak.svg`,
  taksist: `${dir}/taksist.svg`,
  kladoiskatel: `${dir}/kladoiskatel.svg`,
  musorshik: `${dir}/musorshik.svg`,
  fermer: `${dir}/fermer.svg`,
  gribnik: `${dir}/gribnik.svg`,
  ohotnik: `${dir}/ohotnik.svg`,
  karershik: `${dir}/karershik.svg`,
  "voditel-avtobusa": `${dir}/voditel-avtobusa.svg`,
  lesorub: `${dir}/lesorub.svg`,
  pochtalon: `${dir}/pochtalon.svg`,
  elektrik: `${dir}/elektrik.svg`,
  inkassator: `${dir}/inkassator.svg`,
  pozharnyj: `${dir}/pozharnyj.svg`,
  dalnoboishchik: `${dir}/dalnoboishchik.svg`,
  zakladchik: `${dir}/zakladchik.svg`,
  syshchik: `${dir}/syshchik.svg`,
  "grabitel-domov": `${dir}/grabitel-domov.svg`,
  ugonshchik: `${dir}/ugonshchik.svg`,
};

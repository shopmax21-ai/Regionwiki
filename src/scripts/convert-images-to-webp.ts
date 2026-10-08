/**
 * Разовая миграция: переводит картинки, загруженные до появления конвертации, в WebP.
 *
 *   npm run migrate:webp            — только посчитать, что будет изменено
 *   npm run migrate:webp -- --apply — выполнить
 *
 * Адрес картинки (её id) не меняется, поэтому ссылки в гайдах, предметах, транспорте и профилях остаются рабочими:
 * заменяются только содержимое, тип и размер записи. Повторный запуск безопасен, готовые WebP пропускаются.
 * Нужна переменная DATABASE_URL (тот же адрес базы, что у сайта).
 */
import { getPool } from "../lib/db/pool";
import { convertToWebp } from "../lib/images/webp";

const apply = process.argv.includes("--apply");

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} МБ`;

async function main() {
  const pool = getPool();

  const { rows: pending } = await pool.query<{ id: string }>(
    "SELECT id FROM wiki_images WHERE mime <> 'image/webp' ORDER BY created_at, id",
  );
  console.log(`Картинок не в WebP: ${pending.length}${apply ? "" : " (пробный запуск, ничего не меняется)"}`);

  let converted = 0;
  let failed = 0;
  let before = 0;
  let after = 0;

  for (const { id } of pending) {
    const { rows } = await pool.query<{ mime: string; data: Buffer }>(
      "SELECT mime, data FROM wiki_images WHERE id = $1 AND mime <> 'image/webp'",
      [id],
    );
    const row = rows[0];
    if (!row) continue; // за это время картинку уже сконвертировали или удалили

    try {
      const webp = await convertToWebp(row.data);
      before += row.data.byteLength;
      after += webp.byteLength;
      converted++;
      if (!apply) continue;

      // Условие по mime защищает от гонки с параллельным запуском
      await pool.query("UPDATE wiki_images SET mime = 'image/webp', data = $2, size = $3 WHERE id = $1 AND mime = $4", [
        id,
        webp,
        webp.byteLength,
        row.mime,
      ]);
    } catch (error) {
      failed++;
      console.warn(`Пропущена ${id}: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`${apply ? "Сконвертировано" : "Будет сконвертировано"}: ${converted}, не удалось: ${failed}`);
  if (converted > 0) console.log(`Размер: ${mb(before)} → ${mb(after)}`);
  if (!apply && converted > 0) console.log("Чтобы выполнить, запустите с флагом --apply");

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

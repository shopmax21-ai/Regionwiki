"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";

import { Check, Download, FileUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { importPlacesAction } from "../_actions";
import { IMPORT_EXAMPLE, IMPORT_MAX_ROWS, parseImport } from "./import-parse";
import { type MapPlace, placeCategories } from "./map-data";

interface PlaceImportProps {
  /** Нужны, чтобы скачать текущие метки как образец файла */
  places: MapPlace[];
  onClose: () => void;
  /** Вызывается, когда метки загружены: раздел сбрасывает фильтры, чтобы новые метки были видны */
  onImported: () => void;
}

const FILE_MAX_BYTES = 1_000_000;
const SHOWN_ERRORS = 4;

function download(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Загрузка своих меток списком из файла (JSON или CSV) или вставкой текста.
 * Лежит внутри раздела карты, а не в диалоге-портале, поэтому работает и в полноэкранном режиме.
 */
export function PlaceImport({ places, onClose, onImported }: PlaceImportProps) {
  const fieldId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => (text.trim() ? parseImport(text) : null), [text]);

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResult(null);
    if (file.size > FILE_MAX_BYTES) {
      setError("Файл больше 1 МБ: для меток это слишком много, проверьте, тот ли файл");
      return;
    }
    try {
      setText(await file.text());
      setFileName(file.name);
    } catch {
      setError("Не удалось прочитать файл");
    }
  };

  const upload = () => {
    if (!parsed || parsed.rows.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        const response = await importPlacesAction(parsed.rows);
        if (!response.ok) {
          setError(response.error);
          return;
        }
        setResult({ added: response.added, skipped: response.skipped });
        setText("");
        setFileName(null);
        if (response.added > 0) onImported();
      } catch {
        setError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  const exportCurrent = () =>
    download(
      "map-places.json",
      JSON.stringify(
        places.map(({ name, category, x, y, description }) => ({ name, category, x, y, description: description ?? "" })),
        null,
        2,
      ),
      "application/json",
    );

  return (
    <Card
      size="sm"
      className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 max-h-[80%] overflow-y-auto shadow-lg md:inset-x-auto md:right-4 md:bottom-4 md:max-h-[calc(100%-2rem)] md:w-96"
    >
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-medium text-base leading-tight">Загрузка меток</h2>
          <Button
            variant="ghost"
            className="-mt-1 -mr-1 size-10"
            aria-label="Закрыть"
            onClick={onClose}
            disabled={pending}
          >
            <X className="size-5" />
          </Button>
        </div>

        {result ? (
          <div className="flex flex-col gap-3" aria-live="polite">
            <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                {result.added > 0 ? `Добавлено меток: ${result.added}.` : "Новых меток нет."}
                {result.skipped > 0 && ` Пропущено уже существующих: ${result.skipped}.`}
              </span>
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="h-10 flex-1" onClick={() => setResult(null)}>
                Загрузить ещё
              </Button>
              <Button className="h-10 flex-1" onClick={onClose}>
                Готово
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              Файл JSON или CSV с полями name, category, x, y и, по желанию, description. В category подходят:{" "}
              {placeCategories.map((category) => category.id).join(", ")} (или название по-русски). Не больше{" "}
              {IMPORT_MAX_ROWS} меток за раз.
            </p>

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInput}
                type="file"
                accept=".json,.csv,.txt,application/json,text/csv,text/plain"
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => {
                  void readFile(event.target.files?.[0]);
                  // Тот же файл можно выбрать снова после правки
                  event.target.value = "";
                }}
              />
              <Button variant="outline" className="h-10" onClick={() => fileInput.current?.click()} disabled={pending}>
                <FileUp data-icon="inline-start" /> Выбрать файл
              </Button>
              <Button
                variant="ghost"
                className="h-10"
                onClick={() => download("map-places-example.csv", IMPORT_EXAMPLE, "text/csv")}
              >
                <Download data-icon="inline-start" /> Образец CSV
              </Button>
              {places.length > 0 && (
                <Button variant="ghost" className="h-10" onClick={exportCurrent}>
                  <Download data-icon="inline-start" /> Текущие метки
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-text`}>{fileName ? `Файл: ${fileName}` : "Или вставьте текст"}</Label>
              <Textarea
                id={`${fieldId}-text`}
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setFileName(null);
                  setResult(null);
                }}
                placeholder={IMPORT_EXAMPLE}
                spellCheck={false}
                className="max-h-40 min-h-24 font-mono text-xs md:text-xs"
              />
            </div>

            {parsed?.fatal && (
              <p role="alert" className="text-destructive text-sm">
                {parsed.fatal}
              </p>
            )}

            {parsed && !parsed.fatal && (
              <div className="flex flex-col gap-1.5 text-sm" aria-live="polite">
                <p>
                  Готово к загрузке: <span className="font-medium tabular-nums">{parsed.rows.length}</span> из{" "}
                  <span className="tabular-nums">{parsed.total}</span>
                </p>
                {parsed.errors.length > 0 && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
                    <p className="mb-1 font-medium text-destructive">Не будут загружены: {parsed.errors.length}</p>
                    <ul className="flex flex-col gap-0.5 text-muted-foreground">
                      {parsed.errors.slice(0, SHOWN_ERRORS).map((item) => (
                        <li key={`${item.line}-${item.message}`}>
                          Строка {item.line}: {item.message}
                        </li>
                      ))}
                      {parsed.errors.length > SHOWN_ERRORS && <li>…и ещё {parsed.errors.length - SHOWN_ERRORS}</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="h-10 flex-1" onClick={onClose} disabled={pending}>
                Отмена
              </Button>
              <Button className="h-10 flex-1" onClick={upload} disabled={pending || !parsed || parsed.rows.length === 0}>
                {pending ? "Загрузка..." : `Загрузить${parsed && parsed.rows.length > 0 ? ` (${parsed.rows.length})` : ""}`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

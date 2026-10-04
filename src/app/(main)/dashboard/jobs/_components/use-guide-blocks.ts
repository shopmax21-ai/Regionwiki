"use client";

import { useEffect, useRef, useState } from "react";

import { toast } from "sonner";

import { JOB_LIMITS } from "../_data/jobs";
import { type BlockKind, createBlock, type EditorBlock, type EditorSlide, newId } from "./editor-model";
import type { BlockActions } from "./job-block-editor";
import { isImageFile, uploadImage } from "./upload-image";

/** Куда вставлять: после найденного блока, в начало (afterId === null) или в конец, если блок не найден */
function insertPosition(length: number, index: number, afterId: string | null) {
  if (index >= 0) return index + 1;
  return afterId === null ? 0 : length;
}

const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

/**
 * Всё, что нужно для редактирования блоков гайда: список, действия над блоками, загрузка картинок,
 * вставка через Ctrl+V и перетаскивание файлов. Общий для страницы редактора и для правки прямо в гайде.
 *
 * `enabled` включает обработку вставки и перетаскивания файлов (выключено, когда редактор не на экране).
 */
export function useGuideBlocks(initial: () => EditorBlock[], enabled: boolean) {
  const [blocks, setBlocks] = useState<EditorBlock[]>(initial);
  const [dragging, setDragging] = useState(false);
  // Окно шаблонов: afterId — после какого блока вставлять (null — в начало)
  const [templatesTarget, setTemplatesTarget] = useState<{ afterId: string | null } | null>(null);

  // Блок, в котором стоит курсор: туда попадёт картинка, вставленная через Ctrl+V
  const focusedId = useRef<string | null>(null);

  const uploading = blocks.some(
    (block) =>
      ((block.type === "image" || block.type === "textImage") && block.uploading) ||
      (block.type === "slider" && block.slides.some((slide) => slide.uploading)),
  );

  const uploadFailed = blocks.some(
    (block) =>
      ((block.type === "image" || block.type === "textImage") && !block.src && Boolean(block.error)) ||
      (block.type === "slider" && block.slides.some((slide) => !slide.src && Boolean(slide.error))),
  );

  const addSliderFiles: BlockActions["addSliderFiles"] = (files, sliderId) => {
    const images = files.filter(isImageFile);
    if (images.length < files.length) toast.error("Подходят только PNG, JPEG, WebP и GIF");
    if (images.length === 0) return;

    const slider = blocks.find((block) => block.id === sliderId);
    if (!slider || slider.type !== "slider") return;
    if (slider.slides.length + images.length > JOB_LIMITS.sliderSlides) {
      toast.error(`Не больше ${JOB_LIMITS.sliderSlides} слайдов в одном слайдере`);
      return;
    }

    const items = images.map((file) => ({ file, id: newId(), local: URL.createObjectURL(file) }));
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === sliderId && block.type === "slider"
          ? {
              ...block,
              slides: [
                ...block.slides,
                ...items.map(
                  (item): EditorSlide => ({
                    id: item.id,
                    src: "",
                    caption: "",
                    local: item.local,
                    uploading: true,
                  }),
                ),
              ],
            }
          : block,
      ),
    );

    const finish = (local: string, patch: Partial<EditorSlide>) =>
      setBlocks((prev) =>
        prev.map((block) =>
          block.type === "slider"
            ? {
                ...block,
                slides: block.slides.map((slide) => (slide.local === local ? { ...slide, ...patch } : slide)),
              }
            : block,
        ),
      );

    for (const item of items) {
      uploadImage(item.file).then(
        (url) => {
          finish(item.local, { src: url, local: undefined, uploading: false, error: undefined });
          URL.revokeObjectURL(item.local);
        },
        (reason: unknown) => {
          const message = reason instanceof Error ? reason.message : "Не удалось загрузить картинку";
          finish(item.local, { uploading: false, error: message });
          toast.error(message);
        },
      );
    }
  };

  const addFiles: BlockActions["addFiles"] = (files, targetId, options) => {
    const target = targetId ? blocks.find((block) => block.id === targetId) : undefined;
    if (target?.type === "slider" && !options?.replace) {
      addSliderFiles(files, target.id);
      return;
    }

    const images = files.filter(isImageFile);
    if (images.length < files.length) toast.error("Подходят только PNG, JPEG, WebP и GIF");
    if (images.length === 0) return;
    if (blocks.length + images.length > JOB_LIMITS.blocks) {
      toast.error(`Не больше ${JOB_LIMITS.blocks} блоков в одном гайде`);
      return;
    }

    const items = images.map((file) => ({ file, id: newId(), local: URL.createObjectURL(file) }));

    setBlocks((prev) => {
      const next = [...prev];
      const queue = [...items];
      const targetIndex = targetId ? next.findIndex((block) => block.id === targetId) : -1;
      const found = targetIndex >= 0 ? next[targetIndex] : undefined;

      // Пустой блок с картинкой заполняется первым файлом; при «Заменить» заменяется и заполненный
      if ((found?.type === "image" || found?.type === "textImage") && (options?.replace || (!found.src && !found.local))) {
        const first = queue.shift();
        if (first) next[targetIndex] = { ...found, src: "", local: first.local, uploading: true, error: undefined };
      }
      const at = targetIndex >= 0 ? targetIndex + 1 : next.length;
      next.splice(
        at,
        0,
        ...queue.map(
          (item): EditorBlock => ({
            id: item.id,
            type: "image",
            src: "",
            caption: "",
            local: item.local,
            uploading: true,
          }),
        ),
      );
      return next;
    });

    const finish = (
      local: string,
      patch: { src?: string; local?: string; uploading?: boolean; error?: string },
    ) =>
      setBlocks((prev) =>
        prev.map((block) =>
          (block.type === "image" || block.type === "textImage") && block.local === local
            ? { ...block, ...patch }
            : block,
        ),
      );

    for (const item of items) {
      uploadImage(item.file).then(
        (url) => {
          finish(item.local, { src: url, local: undefined, uploading: false, error: undefined });
          URL.revokeObjectURL(item.local);
        },
        (reason: unknown) => {
          const message = reason instanceof Error ? reason.message : "Не удалось загрузить картинку";
          finish(item.local, { uploading: false, error: message });
          toast.error(message);
        },
      );
    }
  };

  /** Вставляет готовые блоки (шаблон, раздел чужого гайда, свой шаблон). Возвращает false, если они не помещаются. */
  const insertBlocks = (additions: EditorBlock[], afterId: string | null): boolean => {
    if (blocks.length + additions.length > JOB_LIMITS.blocks) {
      toast.error(`Не помещается: в гайде максимум ${JOB_LIMITS.blocks} блоков`);
      return false;
    }
    const index = afterId ? blocks.findIndex((item) => item.id === afterId) : -1;
    const at = insertPosition(blocks.length, index, afterId);
    focusedId.current = additions.at(-1)?.id ?? null;
    setBlocks([...blocks.slice(0, at), ...additions, ...blocks.slice(at)]);
    toast.success(`Добавлено блоков: ${additions.length}`);
    return true;
  };

  const actions: BlockActions = {
    update: (id, patch) =>
      setBlocks((prev) => prev.map((block) => (block.id === id ? ({ ...block, ...patch } as EditorBlock) : block))),
    remove: (id) => {
      if (focusedId.current === id) focusedId.current = null;
      setBlocks((prev) => prev.filter((block) => block.id !== id));
    },
    move: (id, direction) =>
      setBlocks((prev) => {
        const index = prev.findIndex((block) => block.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      }),
    duplicate: (id) =>
      setBlocks((prev) => {
        const index = prev.findIndex((block) => block.id === id);
        if (index < 0 || prev.length >= JOB_LIMITS.blocks) return prev;
        const source = prev[index];
        const copy: EditorBlock =
          source.type === "slider"
            ? {
                ...source,
                id: newId(),
                slides: source.slides.map((slide) => ({ ...slide, id: newId() })),
              }
            : { ...source, id: newId() };
        return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
      }),
    insert: (kind: BlockKind, afterId) => {
      const newBlock = createBlock(kind);
      focusedId.current = newBlock.id;
      setBlocks((prev) => {
        const index = afterId ? prev.findIndex((item) => item.id === afterId) : -1;
        const at = insertPosition(prev.length, index, afterId);
        if (prev.length >= JOB_LIMITS.blocks) return prev;
        return [...prev.slice(0, at), newBlock, ...prev.slice(at)];
      });
    },
    openTemplates: (afterId) => setTemplatesTarget({ afterId }),
    addFiles,
    addSliderFiles,
    updateSliderSlide: (sliderId, slideId, patch) =>
      setBlocks((prev) =>
        prev.map((block) =>
          block.id === sliderId && block.type === "slider"
            ? { ...block, slides: block.slides.map((slide) => (slide.id === slideId ? { ...slide, ...patch } : slide)) }
            : block,
        ),
      ),
    removeSliderSlide: (sliderId, slideId) =>
      setBlocks((prev) =>
        prev.map((block) => {
          if (block.id !== sliderId || block.type !== "slider") return block;
          const slide = block.slides.find((item) => item.id === slideId);
          if (slide?.local) URL.revokeObjectURL(slide.local);
          return { ...block, slides: block.slides.filter((item) => item.id !== slideId) };
        }),
      ),
  };

  // Ctrl+V: картинка из буфера обмена (скриншот или скопированный файл) становится блоком
  // Перетаскивание: файлы можно бросить в любое место окна; если бросить на блок, картинка встанет после него
  useEffect(() => {
    if (!enabled) return;
    let depth = 0;

    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter(isImageFile);
      if (files.length === 0) return;
      event.preventDefault();
      addFiles(files, focusedId.current);
    };

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth += 1;
      setDragging(true);
    };
    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      // Обложка принимает файлы сама
      if ((event.target as Element | null)?.closest?.("[data-cover-drop]")) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = 0;
      setDragging(false);
      if ((event.target as Element | null)?.closest?.("[data-cover-drop]")) return;
      // Без этого браузер открыл бы файл в этой вкладке и уничтожил несохранённый гайд
      event.preventDefault();
      const target = (event.target as Element | null)?.closest?.("[data-block-id]");
      addFiles(Array.from(event.dataTransfer?.files ?? []), target?.getAttribute("data-block-id") ?? null);
    };

    document.addEventListener("paste", onPaste);
    document.addEventListener("dragenter", onDragEnter);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("dragenter", onDragEnter);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  });

  /** Обработчик onFocusCapture для контейнера с блоками: запоминает, в каком блоке курсор */
  const trackFocus = (event: React.FocusEvent) => {
    const block = (event.target as Element).closest("[data-block-id]");
    if (block) focusedId.current = block.getAttribute("data-block-id");
  };

  return {
    blocks,
    actions,
    insertBlocks,
    uploading,
    uploadFailed,
    dragging,
    trackFocus,
    templatesTarget,
    closeTemplates: () => setTemplatesTarget(null),
  };
}

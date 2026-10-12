"use client";

import { type FormEvent, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ExternalLink, Funnel, Megaphone, Pencil, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { FilterDropdown } from "@/app/(main)/(dashboard)/_components/filter-dropdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  MEDIA_PR_LIMITS,
  type MediaPrEntry,
  type MediaPrPlatform,
  type MediaPrStatus,
  mediaPrPlatformLabels,
  mediaPrPlatforms,
  mediaPrStatuses,
  mediaPrStatusLabels,
} from "@/lib/mediapr/types";

import {
  createMediaPrAction,
  deleteMediaPrAction,
  type MediaPrResult,
  saveMediaPrInfoAction,
  updateMediaPrAction,
} from "../_actions";

const NETWORK_ERROR = { ok: false, error: "Нет связи с сервером, попробуйте ещё раз" } as const;

const numberFormat = new Intl.NumberFormat("ru-RU");
const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" });

type PlatformFilter = MediaPrPlatform | "all";
type StatusFilter = MediaPrStatus | "all";

const PLATFORM_OPTIONS: { id: PlatformFilter; label: string }[] = [
  { id: "all", label: "Все площадки" },
  ...mediaPrPlatforms.map((id) => ({ id, label: mediaPrPlatformLabels[id] })),
];

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Все статусы" },
  ...mediaPrStatuses.map((id) => ({ id, label: mediaPrStatusLabels[id] })),
];

const STATUS_BADGE: Record<MediaPrStatus, string> = {
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  talks: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  paused: "text-muted-foreground",
};

const normalize = (value: string) => value.toLowerCase().replaceAll("ё", "е").trim();

function StatusBadge({ status }: { status: MediaPrStatus }) {
  return (
    <Badge variant="outline" className={STATUS_BADGE[status]}>
      {mediaPrStatusLabels[status]}
    </Badge>
  );
}

type Draft = {
  id: string | null;
  name: string;
  platform: MediaPrPlatform;
  url: string;
  contact: string;
  audience: string;
  status: MediaPrStatus;
  note: string;
};

const emptyDraft = (): Draft => ({
  id: null,
  name: "",
  platform: "twitch",
  url: "",
  contact: "",
  audience: "",
  status: "talks",
  note: "",
});

const toDraft = (entry: MediaPrEntry): Draft => ({
  id: entry.id,
  name: entry.name,
  platform: entry.platform,
  url: entry.url,
  contact: entry.contact,
  audience: entry.audience === null ? "" : String(entry.audience),
  status: entry.status,
  note: entry.note,
});

/** Справка раздела. Тем, у кого есть право, текст правится прямо на странице. */
function InfoCard({ info, canEdit }: { info: string; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(info);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (value: string) => {
    setError(null);
    startTransition(async () => {
      const result = await saveMediaPrInfoAction(value).catch(() => NETWORK_ERROR);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(value === "" ? "Возвращена справка по умолчанию" : "Справка сохранена");
      setEditing(false);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-4 text-muted-foreground" aria-hidden="true" />О разделе
        </CardTitle>
        {canEdit && !editing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setText(info);
              setEditing(true);
            }}
          >
            <Pencil aria-hidden="true" />
            Изменить
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="flex flex-col gap-3">
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={MEDIA_PR_LIMITS.info}
              aria-label="Текст справки"
              className="min-h-48"
            />
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save(text)} disabled={pending}>
                {pending ? "Сохранение..." : "Сохранить"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)} disabled={pending}>
                Отмена
              </Button>
              <Button variant="ghost" className="ml-auto" onClick={() => save("")} disabled={pending}>
                <RotateCcw aria-hidden="true" />
                Вернуть по умолчанию
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-line text-sm leading-relaxed">{info}</p>
        )}
      </CardContent>
    </Card>
  );
}

function EntryDialog({
  draft,
  onChange,
  onClose,
  onSave,
  pending,
  error,
}: {
  draft: Draft | null;
  onChange: (patch: Partial<Draft>) => void;
  onClose: () => void;
  onSave: () => void;
  pending: boolean;
  error: string | null;
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave();
  };

  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
        onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              if (!pending) onSave();
            }
          }}
      >
        {draft && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{draft.id ? "Изменить запись" : "Новое медиа"}</DialogTitle>
              <DialogDescription>Стример, ютубер или сообщество, с которым работает проект.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mpr-name">Название</Label>
              <Input
                id="mpr-name"
                value={draft.name}
                maxLength={MEDIA_PR_LIMITS.name}
                onChange={(event) => onChange({ name: event.target.value })}
                placeholder="Ник стримера или название канала"
                autoComplete="off"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mpr-platform">Площадка</Label>
                <NativeSelect
                  id="mpr-platform"
                  className="w-full"
                  value={draft.platform}
                  onChange={(event) => onChange({ platform: event.target.value as MediaPrPlatform })}
                >
                  {mediaPrPlatforms.map((id) => (
                    <NativeSelectOption key={id} value={id}>
                      {mediaPrPlatformLabels[id]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mpr-status">Статус</Label>
                <NativeSelect
                  id="mpr-status"
                  className="w-full"
                  value={draft.status}
                  onChange={(event) => onChange({ status: event.target.value as MediaPrStatus })}
                >
                  {mediaPrStatuses.map((id) => (
                    <NativeSelectOption key={id} value={id}>
                      {mediaPrStatusLabels[id]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mpr-url">Ссылка</Label>
              <Input
                id="mpr-url"
                value={draft.url}
                maxLength={MEDIA_PR_LIMITS.url}
                onChange={(event) => onChange({ url: event.target.value })}
                placeholder="https://twitch.tv/имя"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mpr-audience">Аудитория</Label>
                <Input
                  id="mpr-audience"
                  value={draft.audience}
                  onChange={(event) => onChange({ audience: event.target.value })}
                  placeholder="Подписчики или онлайн"
                  inputMode="numeric"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mpr-contact">Контакты</Label>
                <Input
                  id="mpr-contact"
                  value={draft.contact}
                  maxLength={MEDIA_PR_LIMITS.contact}
                  onChange={(event) => onChange({ contact: event.target.value })}
                  placeholder="Telegram, Discord"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mpr-note">Заметка</Label>
              <Textarea
                id="mpr-note"
                value={draft.note}
                maxLength={MEDIA_PR_LIMITS.note}
                onChange={(event) => onChange({ note: event.target.value })}
                placeholder="О чём договорились, что важно помнить"
                className="max-h-40 min-h-20"
              />
            </div>

            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}

            <DialogFooter className="items-center sm:justify-between">
              <span className="hidden text-muted-foreground text-xs sm:inline">
                <kbd className="rounded border bg-background px-1 font-sans">Ctrl</kbd>+
                <kbd className="rounded border bg-background px-1 font-sans">Enter</kbd> — сохранить
              </span>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                  Отмена
                </Button>
                <Button type="submit" disabled={pending || draft.name.trim() === ""}>
                  {pending ? "Сохранение..." : "Сохранить"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function MediaPrSection({
  entries,
  info,
  canEdit,
}: {
  entries: MediaPrEntry[];
  info: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<MediaPrEntry | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const needle = normalize(query);
    return entries.filter((entry) => {
      if (platform !== "all" && entry.platform !== platform) return false;
      if (status !== "all" && entry.status !== status) return false;
      if (!needle) return true;
      return normalize(`${entry.name} ${entry.contact} ${entry.note}`).includes(needle);
    });
  }, [entries, query, platform, status]);

  const partners = entries.filter((entry) => entry.status === "active").length;
  const totalAudience = entries.reduce((sum, entry) => sum + (entry.audience ?? 0), 0);
  const filtering = query.trim() !== "" || platform !== "all" || status !== "all";

  const finish = (result: MediaPrResult, success: string, onOk: () => void, onError: (error: string) => void) => {
    if (!result.ok) {
      onError(result.error);
      return;
    }
    toast.success(success);
    onOk();
    router.refresh();
  };

  const saveDraft = () => {
    if (!draft) return;
    setFormError(null);
    const payload = {
      name: draft.name,
      platform: draft.platform,
      url: draft.url,
      contact: draft.contact,
      audience: draft.audience,
      status: draft.status,
      note: draft.note,
    };
    startTransition(async () => {
      const result = await (draft.id ? updateMediaPrAction(draft.id, payload) : createMediaPrAction(payload)).catch(
        () => NETWORK_ERROR,
      );
      finish(result, draft.id ? "Запись сохранена" : "Медиа добавлено", () => setDraft(null), setFormError);
    });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteMediaPrAction(deleting.id).catch(() => NETWORK_ERROR);
      finish(result, "Запись удалена", () => setDeleting(null), setDeleteError);
    });
  };

  const openEdit = (entry: MediaPrEntry) => {
    setFormError(null);
    setDraft(toDraft(entry));
  };

  const rowActions = (entry: MediaPrEntry) =>
    canEdit && (
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => openEdit(entry)}
          aria-label={`Изменить ${entry.name}`}
          title="Изменить"
        >
          <Pencil aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            setDeleteError(null);
            setDeleting(entry);
          }}
          aria-label={`Удалить ${entry.name}`}
          title="Удалить"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    );

  const nameCell = (entry: MediaPrEntry) =>
    entry.url ? (
      <a
        href={entry.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 font-medium hover:underline"
      >
        <span className="truncate">{entry.name}</span>
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </a>
    ) : (
      <span className="font-medium">{entry.name}</span>
    );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 pb-10 md:gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-xl">Медиа PR</h1>
        <p className="text-muted-foreground text-sm">Справка и таблица медиа, с которыми работает проект.</p>
      </div>

      <InfoCard info={info} canEdit={canEdit} />

      <section className="flex flex-col gap-3" aria-label="Таблица медиа">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="h-7 px-2.5 text-sm">
            Медиа: {entries.length}
          </Badge>
          <Badge variant="outline" className="h-7 px-2.5 text-sm">
            Сотрудничаем: {partners}
          </Badge>
          {totalAudience > 0 && (
            <Badge variant="outline" className="h-7 px-2.5 text-sm">
              Общая аудитория: {numberFormat.format(totalAudience)}
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-sm">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по названию, контактам и заметкам"
              aria-label="Поиск по таблице медиа"
              data-section-search
              className="pr-9 pl-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Очистить поиск"
                className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:flex-1">
            <FilterDropdown
              icon={Funnel}
              label="Площадка"
              value={platform}
              options={PLATFORM_OPTIONS}
              onChange={setPlatform}
              className="max-sm:flex-1"
            />
            <FilterDropdown
              icon={Funnel}
              label="Статус"
              value={status}
              options={STATUS_OPTIONS}
              onChange={setStatus}
              className="max-sm:flex-1"
            />
            {canEdit && (
              <Button
                className="h-10 max-sm:w-full lg:ml-auto"
                onClick={() => {
                  setFormError(null);
                  setDraft(emptyDraft());
                }}
              >
                <Plus aria-hidden="true" />
                Добавить медиа
              </Button>
            )}
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            В таблице пока никого нет.{canEdit ? " Нажмите «Добавить медиа», чтобы создать первую запись." : ""}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            Никого не нашли{filtering ? ": попробуйте изменить поиск или фильтры." : "."}
          </div>
        ) : (
          <>
            <p className="text-muted-foreground text-xs" aria-live="polite">
              {filtering ? `Найдено: ${visible.length} из ${entries.length}` : `Всего: ${entries.length}`}
            </p>

            <div className="hidden overflow-hidden rounded-xl border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Медиа</TableHead>
                    <TableHead>Площадка</TableHead>
                    <TableHead className="text-right">Аудитория</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Контакты</TableHead>
                    <TableHead>Заметка</TableHead>
                    <TableHead>Изменено</TableHead>
                    {canEdit && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="max-w-56">{nameCell(entry)}</TableCell>
                      <TableCell>{mediaPrPlatformLabels[entry.platform]}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.audience === null ? "—" : numberFormat.format(entry.audience)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={entry.status} />
                      </TableCell>
                      <TableCell className="max-w-44 whitespace-normal break-words">{entry.contact || "—"}</TableCell>
                      <TableCell className="max-w-64 whitespace-normal break-words text-muted-foreground">
                        {entry.note || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                        {dateFormat.format(new Date(entry.updatedAt))}
                      </TableCell>
                      {canEdit && <TableCell>{rowActions(entry)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="grid gap-3 md:hidden">
              {visible.map((entry) => (
                <li key={entry.id}>
                  <Card size="sm">
                    <CardContent className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-col gap-1">
                          {nameCell(entry)}
                          <span className="text-muted-foreground text-xs">
                            {mediaPrPlatformLabels[entry.platform]}
                            {entry.audience !== null && ` · ${numberFormat.format(entry.audience)}`}
                          </span>
                        </div>
                        <StatusBadge status={entry.status} />
                      </div>
                      {entry.contact && <p className="break-words text-sm">{entry.contact}</p>}
                      {entry.note && <p className="break-words text-muted-foreground text-sm">{entry.note}</p>}
                      {rowActions(entry)}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <EntryDialog
        draft={draft}
        onChange={(patch) => setDraft((current) => (current ? { ...current, ...patch } : current))}
        onClose={() => setDraft(null)}
        onSave={saveDraft}
        pending={pending}
        error={formError}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && !pending && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить запись?</DialogTitle>
            <DialogDescription>«{deleting?.name}» исчезнет из таблицы у всех. Отменить это нельзя.</DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p role="alert" className="text-destructive text-sm">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={pending}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={pending}>
              {pending ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

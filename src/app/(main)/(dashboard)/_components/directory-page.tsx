import Link from "next/link";

import { FolderPlus, Grid2X2, List, Upload } from "lucide-react";
import type { Metadata } from "next";

import type {
  FileManagerFile,
  FileManagerFolder,
  FileManagerView,
} from "@/app/(main)/dashboard/file-manager/_components/data";
import { FileGridView } from "@/app/(main)/dashboard/file-manager/_components/file-grid-view";
import { FileListView } from "@/app/(main)/dashboard/file-manager/_components/file-list-view";
import { FileManagerToolbar } from "@/app/(main)/dashboard/file-manager/_components/file-manager-toolbar";
import { FoldersSection } from "@/app/(main)/dashboard/file-manager/_components/folders-section";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface DirectoryPageProps {
  title: string;
  description: string;
  viewPath: string;
  folders: FileManagerFolder[];
  files: FileManagerFile[];
  view?: string | string[];
}

export function DirectoryPage({ title, description, viewPath, folders, files, view }: DirectoryPageProps) {
  const activeView: FileManagerView = view === "list" ? "list" : "grid";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <FolderPlus data-icon="inline-start" />
            Новая папка
          </Button>
          <Button>
            <Upload data-icon="inline-start" />
            Загрузить
          </Button>
        </div>
      </div>
      <FileManagerToolbar />
      <FoldersSection folders={folders} />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-medium text-lg">Все файлы</h2>
          <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={activeView} aria-label="Вид файлов">
            <ToggleGroupItem value="grid" asChild>
              <Link href={`${viewPath}?view=grid`} prefetch={false} replace scroll={false}>
                <Grid2X2 />
                Сетка
              </Link>
            </ToggleGroupItem>
            <ToggleGroupItem value="list" asChild>
              <Link href={`${viewPath}?view=list`} prefetch={false} replace scroll={false}>
                <List />
                Список
              </Link>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        {activeView === "list" ? <FileListView files={files} /> : <FileGridView files={files} />}
      </div>
    </div>
  );
}

export type DirectoryMetadata = Metadata;

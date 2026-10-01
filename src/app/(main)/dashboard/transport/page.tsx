import type { Metadata } from "next";

import { type FileManagerView, files, folders } from "../file-manager/_components/data";
import { FileGridView } from "../file-manager/_components/file-grid-view";
import { FileListView } from "../file-manager/_components/file-list-view";
import { FileManagerToolbar } from "../file-manager/_components/file-manager-toolbar";
import { FoldersSection } from "../file-manager/_components/folders-section";

export const metadata: Metadata = {
  title: "Транспорт",
  description: "Документы и файлы раздела транспорта.",
  alternates: { canonical: "/dashboard/transport" },
};

interface PageProps {
  searchParams: Promise<{ view?: string | string[] }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { view } = await searchParams;
  const activeView: FileManagerView = view === "list" ? "list" : "grid";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-none tracking-tight">Транспорт</h1>
        <p className="text-muted-foreground text-sm">Документы, справочники и материалы о транспорте.</p>
      </div>
      <FileManagerToolbar />
      <FoldersSection folders={folders} />
      <div className="flex flex-col gap-2">
        <h2 className="font-medium text-lg">Все файлы</h2>
        {activeView === "list" ? <FileListView files={files} /> : <FileGridView files={files} />}
      </div>
    </div>
  );
}

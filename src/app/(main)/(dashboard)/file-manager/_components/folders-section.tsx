import { Folder } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

import type { FileManagerFolder } from "./data";

export function FoldersSection({ folders }: { folders: FileManagerFolder[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-medium text-lg">Папки</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {folders.map((folder) => (
          <Card key={folder.id} size="sm">
            <CardContent className="flex items-center gap-3">
              <Folder className="size-8 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate font-medium text-sm">{folder.name}</p>
                <p className="truncate text-muted-foreground text-xs">
                  {folder.fileCount} файлов · {folder.size}
                </p>
                <p className="truncate text-muted-foreground text-xs">{folder.updatedAt}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

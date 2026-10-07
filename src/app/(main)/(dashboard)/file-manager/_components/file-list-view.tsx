import { FileText, Star, Users } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import type { FileManagerFile } from "./data";

export function FileListView({ files }: { files: FileManagerFile[] }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Название</TableHead>
            <TableHead>Владелец</TableHead>
            <TableHead>Изменён</TableHead>
            <TableHead className="text-right">Размер</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow key={file.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{file.name}</span>
                  {file.shared && <Users className="size-3.5 text-muted-foreground" aria-label="Общий доступ" />}
                  {file.starred && <Star className="size-3.5 fill-current text-muted-foreground" aria-label="В избранном" />}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{file.owner}</TableCell>
              <TableCell className="text-muted-foreground">{file.modifiedAt}</TableCell>
              <TableCell className="text-right text-muted-foreground">{file.size}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

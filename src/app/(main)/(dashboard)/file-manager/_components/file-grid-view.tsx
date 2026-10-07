import { FileText, Star, Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

import type { FileManagerFile } from "./data";

export function FileGridView({ files }: { files: FileManagerFile[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {files.map((file) => (
        <Card key={file.id} size="sm">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <FileText className="size-8 text-muted-foreground" />
              <div className="flex items-center gap-2 text-muted-foreground">
                {file.shared && <Users className="size-4" aria-label="Общий доступ" />}
                {file.starred && <Star className="size-4 fill-current" aria-label="В избранном" />}
              </div>
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-sm">{file.name}</p>
              <p className="text-muted-foreground text-xs">
                {file.size} · {file.modifiedAt}
              </p>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Avatar className="size-6">
                <AvatarFallback className="text-[10px]">{file.ownerInitials}</AvatarFallback>
              </Avatar>
              <span className="truncate">{file.owner}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

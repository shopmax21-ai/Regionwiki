import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

export function FileManagerToolbar() {
  return (
    <div className="relative max-w-md">
      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" placeholder="Поиск файлов и папок" className="pl-9" aria-label="Поиск" data-section-search />
    </div>
  );
}

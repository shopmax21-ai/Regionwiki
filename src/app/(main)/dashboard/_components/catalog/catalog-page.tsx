import Link from "next/link";

import { FolderPlus, Grid2X2, List } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { CatalogAddDialog } from "./catalog-add-dialog";
import { CatalogCategories } from "./catalog-categories";
import { CatalogEntries } from "./catalog-entries";
import { CatalogStoreProvider } from "./catalog-store";
import { CatalogToolbar } from "./catalog-toolbar";
import type { CatalogConfig, CatalogKindOption, CatalogView } from "./catalog-types";

interface CatalogPageProps {
  config: CatalogConfig;
  view: CatalogView;
}

export function CatalogPage({ config, view }: CatalogPageProps) {
  const kinds: CatalogKindOption[] = config.kinds.map((kind) => {
    const KindIcon = kind.icon;

    return { value: kind.value, label: kind.label, icon: <KindIcon /> };
  });

  return (
    <CatalogStoreProvider
      storageKey={`region-next:catalog:${config.domain}`}
      initialEntries={config.entries}
      kinds={kinds}
      defaultOwner={config.defaultOwner}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl leading-none tracking-tight">{config.title}</h1>
            <p className="text-muted-foreground text-sm">{config.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <FolderPlus data-icon="inline-start" />
              {config.newCategoryLabel}
            </Button>
            <CatalogAddDialog
              addLabel={config.addLabel}
              title={config.addDialogTitle}
              description={config.addDialogDescription}
              namePlaceholder={config.namePlaceholder}
              kindLabel={config.kindFilterLabel}
              ownerLabel={config.ownerColumn}
              sharedLabel={config.sharedLabel}
              addedMessage={config.entryAddedMessage}
            sections={config.detailSections}
            />
          </div>
        </div>
        <CatalogToolbar config={config} />
        <CatalogCategories config={config} />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-medium text-lg">{config.allTitle}</h2>
            <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={view} aria-label={config.viewLabel}>
              <ToggleGroupItem value="grid" asChild>
                <Link href="?view=grid" prefetch={false} replace scroll={false}>
                  <Grid2X2 />
                  Плитка
                </Link>
              </ToggleGroupItem>
              <ToggleGroupItem value="list" asChild>
                <Link href="?view=list" prefetch={false} replace scroll={false}>
                  <List />
                  Список
                </Link>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <CatalogEntries
            view={view}
            ownerColumn={config.ownerColumn}
            sharedLabel={config.sharedLabel}
            sections={config.detailSections}
          />
        </div>
      </div>
    </CatalogStoreProvider>
  );
}

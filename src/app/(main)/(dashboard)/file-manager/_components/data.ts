export type FileManagerView = "grid" | "list";

export type FileKind = "pdf" | "doc" | "image" | "archive" | "other";

export interface FileManagerFolder {
  id: string;
  name: string;
  fileCount: number;
  size: string;
  updatedAt: string;
}

export interface FileManagerFile {
  id: string;
  name: string;
  kind: FileKind;
  size: string;
  owner: string;
  ownerInitials: string;
  modifiedAt: string;
  shared: boolean;
  starred: boolean;
}

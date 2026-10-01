import type { FileManagerFile, FileManagerFolder } from "@/app/(main)/dashboard/file-manager/_components/data";

const owners = [
  ["Алексей Иванов", "АИ"],
  ["Мария Петрова", "МП"],
  ["Команда Region WIKI", "RW"],
] as const;

export function createDirectoryData(category: string): { folders: FileManagerFolder[]; files: FileManagerFile[] } {
  const folderNames = ["Документы", "Объявления", "Фото и медиа", "Договоры", "Архив"];
  const fileNames = [
    "Основная информация",
    "Актуальные объявления",
    "Контакты и документы",
    "Полезные материалы",
    "Правила раздела",
    "Справочник региона",
  ];

  return {
    folders: folderNames.map((name, index) => ({
      id: `${category}-folder-${index}`,
      name,
      fileCount: 8 + index * 5,
      size: `${240 + index * 180} MB`,
      updatedAt: index === 0 ? "Сегодня" : `${index + 1} дн. назад`,
    })),
    files: fileNames.map((name, index) => {
      const [owner, ownerInitials] = owners[index % owners.length];
      return {
        id: `${category}-file-${index}`,
        name: `${name}.pdf`,
        kind: "pdf" as const,
        size: `${1 + index}.2 MB`,
        owner,
        ownerInitials,
        modifiedAt: index === 0 ? "Сегодня" : `${index + 1} дней назад`,
        shared: index % 2 === 0,
        starred: index === 0 || index === 4,
      };
    }),
  };
}

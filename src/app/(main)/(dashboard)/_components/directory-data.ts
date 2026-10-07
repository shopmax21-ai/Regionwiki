import type { FileManagerFile, FileManagerFolder } from "@/app/(main)/(dashboard)/file-manager/_components/data";

const owners = [
  ["Алексей Иванов", "АИ"],
  ["Мария Петрова", "МП"],
  ["Команда Region WIKI", "RW"],
] as const;

export function createDirectoryData(category: string): { folders: FileManagerFolder[]; files: FileManagerFile[] } {
  const categoryContent = {
    transport: {
      folders: ["Автомобили", "Общественный транспорт", "Запчасти", "Услуги перевозки", "Архив"],
      files: [
        "Продажа автомобилей",
        "Расписание транспорта",
        "Грузоперевозки и услуги",
        "Запчасти и аксессуары",
        "Правила дорожного движения",
        "Полезные контакты транспортных служб",
      ],
    },
    default: {
      folders: ["Документы", "Объявления", "Фото и медиа", "Договоры", "Архив"],
      files: [
        "Основная информация",
        "Актуальные объявления",
        "Контакты и документы",
        "Полезные материалы",
        "Правила раздела",
        "Справочник региона",
      ],
    },
  };
  const content = categoryContent[category as keyof typeof categoryContent] ?? categoryContent.default;
  const folderNames = content.folders;
  const fileNames = content.files;

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

export const categories = ["Все", "Дома", "Квартиры", "Офисы", "Склады"] as const;

export type Category = (typeof categories)[number];
export type RealtyCategory = Exclude<Category, "Все">;

export type Realty = {
  /** Номер объекта — показывается в заголовке («Дом #1556») и используется как ID */
  id: number;
  category: RealtyCategory;
  /** Гос. стоимость */
  price: number;
  /** Сколько жильцов можно прописать */
  residents: number;
  /** Количество гаражных мест */
  garage: number;
  /** Путь к картинке экстерьера: локальный (/images/real-estate/...) или внешний URL */
  exteriorUrl?: string;
  /** Путь к картинке интерьера */
  interiorUrl?: string;
};

export const singularTitles: Record<RealtyCategory, string> = {
  Дома: "Дом",
  Квартиры: "Квартира",
  Офисы: "Офис",
  Склады: "Склад",
};

// TODO: временные данные, заменить реальным списком. Порядок не важен: «Сначала новые» сортирует по номеру объекта.
const templates: Omit<Realty, "id">[] = [
  { category: "Дома", price: 100_000, residents: 2, garage: 2 },
  { category: "Дома", price: 240_000, residents: 3, garage: 3 },
  { category: "Дома", price: 400_000, residents: 4, garage: 4 },
  { category: "Дома", price: 1_200_000, residents: 8, garage: 8 },
  { category: "Дома", price: 8_000_000, residents: 11, garage: 10 },
  { category: "Дома", price: 24_000_000, residents: 15, garage: 30 },
  { category: "Квартиры", price: 90_000, residents: 2, garage: 1 },
  { category: "Квартиры", price: 180_000, residents: 3, garage: 2 },
  { category: "Квартиры", price: 650_000, residents: 4, garage: 3 },
  { category: "Офисы", price: 500_000, residents: 0, garage: 2 },
  { category: "Офисы", price: 2_000_000, residents: 0, garage: 6 },
  { category: "Склады", price: 350_000, residents: 0, garage: 4 },
  { category: "Склады", price: 1_500_000, residents: 0, garage: 10 },
];

/** Полностью заполненный объект с фото экстерьера и интерьера — эталон для остальных. */
const featured: Realty[] = [
  {
    id: 1556,
    category: "Дома",
    price: 24_000_000,
    residents: 15,
    garage: 30,
    exteriorUrl: "/images/real-estate/1556-exterior.jpg",
    interiorUrl: "/images/real-estate/1556-interior.jpg",
  },
];

const generated: Realty[] = Array.from({ length: 120 }, (_, index) => ({
  id: 1000 + index + 1,
  ...templates[(index * 7) % templates.length],
}));

export const realties: Realty[] = [...featured, ...generated];

export const formatPrice = (price: number) => `${price.toLocaleString("ru-RU")}\u00A0₽`;

export const realtyTitle = (realty: Realty) => `${singularTitles[realty.category]} #${realty.id}`;

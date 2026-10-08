export const categories = [
  "Все",
  "Магазин 24/7",
  "Заправка",
  "Банкомат",
  "Оружейный магазин",
  "Магазин одежды",
  "Автосалон",
  "Тату-салон",
  "Тюнинг салон",
  "Барбершоп",
  "Автомойка",
  "Автомастерские",
] as const;

export type Category = (typeof categories)[number];
export type BusinessCategory = Exclude<Category, "Все">;

export type Business = {
  /** Номер внутри типа бизнеса: «Банкомат #90» и «Заправка #90» — разные объекты */
  id: number;
  category: BusinessCategory;
  /** Гос. стоимость */
  price: number;
  /** Путь к фото: локальный (/images/business/...) или внешний URL */
  imageUrl?: string;
  /** Где бизнес находится на карте штата (игровые координаты, как у меток карты) */
  location?: { x: number; y: number };
};

/** Короткие латинские имена типов: из них и номера собирается код бизнеса для адресов API («shop-5»). */
export const categorySlugs: Record<BusinessCategory, string> = {
  "Магазин 24/7": "shop",
  Заправка: "gas",
  Банкомат: "atm",
  "Оружейный магазин": "gun",
  "Магазин одежды": "clothes",
  Автосалон: "dealer",
  "Тату-салон": "tattoo",
  "Тюнинг салон": "tuning",
  Барбершоп: "barber",
  Автомойка: "wash",
  Автомастерские: "garage",
};

export const businessCode = (business: Pick<Business, "category" | "id">) =>
  `${categorySlugs[business.category]}-${business.id}`;

/** Ссылка на карту штата с этим местом: карта откроется уже приближенной, с меткой. */
export function businessMapHref(business: Business): string | null {
  if (!business.location) return null;
  const params = new URLSearchParams({
    x: String(business.location.x),
    y: String(business.location.y),
    name: businessTitle(business),
  });
  return `/map?${params.toString()}`;
}

export const businessTitle = (business: Business) => `${business.category} #${business.id}`;

export const businessKey = (business: Business) => `${business.category}-${business.id}`;

export const formatPrice = (price: number) => `${price.toLocaleString("ru-RU")}\u00A0₽`;

const categoryOrder = new Map<string, number>(categories.map((category, index) => [category, index]));

export const compareByCategory = (a: Business, b: Business) =>
  (categoryOrder.get(a.category) ?? 0) - (categoryOrder.get(b.category) ?? 0);

// TODO: временные данные, заменить реальным списком. Для каждого типа задано число объектов и набор цен по кругу.
const seed: Record<BusinessCategory, { count: number; prices: number[] }> = {
  "Магазин 24/7": { count: 22, prices: [750_000, 1_000_000, 1_200_000, 1_500_000, 1_750_000, 2_250_000] },
  Заправка: { count: 28, prices: [500_000, 600_000, 750_000, 800_000] },
  Банкомат: { count: 60, prices: [150_000, 250_000, 300_000, 400_000, 500_000, 750_000, 1_500_000, 3_000_000] },
  "Оружейный магазин": { count: 8, prices: [2_000_000, 3_500_000, 5_000_000] },
  "Магазин одежды": { count: 12, prices: [800_000, 1_200_000, 2_000_000] },
  Автосалон: { count: 6, prices: [8_000_000, 12_000_000, 20_000_000] },
  "Тату-салон": { count: 8, prices: [600_000, 900_000, 1_400_000] },
  "Тюнинг салон": { count: 6, prices: [3_000_000, 6_000_000, 9_000_000] },
  Барбершоп: { count: 10, prices: [500_000, 700_000, 1_100_000] },
  Автомойка: { count: 8, prices: [400_000, 650_000, 900_000] },
  Автомастерские: { count: 8, prices: [1_500_000, 2_500_000, 4_000_000] },
};

export const businesses: Business[] = (Object.keys(seed) as BusinessCategory[]).flatMap((category) => {
  const { count, prices } = seed[category];
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    category,
    price: prices[(index * 3) % prices.length],
  }));
});

/** «1 бизнес», «2 бизнеса», «5 бизнесов» */
export function pluralBusinesses(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "бизнес";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "бизнеса";
  return "бизнесов";
}

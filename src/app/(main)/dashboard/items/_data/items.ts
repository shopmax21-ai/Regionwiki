export const categories = [
  "Все",
  "Продукты",
  "Инструменты",
  "Рыба",
  "Оборудование",
  "Алкоголь",
  "Амуниция",
  "Медицина",
  "Автозапчасти",
  "Прочее",
  "Расходники",
  "Инфраструктура",
  "Документы",
  "Книги",
  "Личные вещи",
  "Продукция",
  "Материалы",
  "Одежда",
  "Мусор",
  "Сельское хозяйство",
  "Стафф",
  "Ингредиенты",
  "Броня",
  "Разное",
] as const;

export type Category = (typeof categories)[number];
export type ItemCategory = Exclude<Category, "Все">;

/** Категории, которые можно назначить предмету (без фильтра «Все») */
export const itemCategories: readonly ItemCategory[] = categories.filter(
  (category): category is ItemCategory => category !== "Все",
);

export const isItemCategory = (value: unknown): value is ItemCategory =>
  typeof value === "string" && (itemCategories as readonly string[]).includes(value);

/** Свойства предмета: в окне предмета выводятся строками «Да» / «Нет» в таком же порядке. */
export const itemFlagDefs = [
  { key: "canUse", label: "Можно использовать в инвентаре", default: false },
  { key: "canTake", label: "Возможно достать предмет", default: true },
  { key: "dropOnDeath", label: "Выпадает из инвентаря при смерти", default: true },
  { key: "dropOnLogout", label: "Выпадает из инвентаря при выходе из игры", default: true },
  { key: "movable", label: "Можно перемещать куда-то кроме инвентаря", default: true },
  { key: "seizable", label: "Может быть изъято гос. органами", default: false },
  { key: "trunk", label: "Можно положить в багажник не матовозки", default: true },
] as const;

export type ItemFlagKey = (typeof itemFlagDefs)[number]["key"];
export type ItemFlags = Record<ItemFlagKey, boolean>;

/** Значения для нового предмета и для тех, у кого свойства ещё не заданы */
export const defaultItemFlags: ItemFlags = Object.fromEntries(
  itemFlagDefs.map((def) => [def.key, def.default]),
) as ItemFlags;

export type Item = {
  /** Порядковый номер предмета: чем больше, тем новее */
  id: number;
  name: string;
  category: ItemCategory;
  /** Путь к картинке: локальный (/images/items/...) или внешний URL */
  imageUrl?: string;
  /** Короткое описание под названием */
  description?: string;
  /** Вес одного предмета, кг */
  weight?: number;
  /** Где получить. Если пусто, окно подставляет раздел категории */
  obtain?: string;
  flags: ItemFlags;
};

export const itemKey = (item: Item) => `${item.category}-${item.id}`;

/**
 * Стартовые данные: попадают в базу один раз при её создании, дальше предметы правятся на сайте.
 * Порядок в списке задаёт номера: предметы получают id по очереди, новые идут в конец.
 */
const seed: Record<ItemCategory, string[]> = {
  Продукты: ["Хлеб", "Молоко", "Яблоко", "Бутерброд", "Чипсы", "Шоколадный батончик", "Консервы"],
  Инструменты: ["Молоток", "Отвёртка", "Гаечный ключ", "Лопата", "Кирка", "Монтировка", "Удочка"],
  Рыба: ["Щука", "Карп", "Окунь", "Форель", "Лосось", "Сом"],
  Оборудование: ["Рация", "Фонарик", "Бинокль", "Генератор", "Навигатор", "Дрель"],
  Алкоголь: ["Пиво", "Вино", "Виски", "Водка", "Шампанское"],
  Амуниция: ["Магазин пистолетный", "Патроны 9 мм", "Патроны 5.56 мм", "Дробь"],
  Медицина: ["Аптечка", "Бинт", "Обезболивающее", "Нашатырный спирт", "Антибиотик"],
  Автозапчасти: ["Аккумулятор", "Фильтр масляный", "Свечи зажигания", "Тормозные колодки", "Колесо"],
  Прочее: ["Зажигалка", "Сигареты", "Ключ от автомобиля", "Верёвка"],
  Расходники: ["Канистра с бензином", "Ремкомплект", "Скотч", "Батарейки"],
  Инфраструктура: ["Дорожный конус", "Ограждение", "Знак остановки"],
  Документы: ["Паспорт", "Водительские права", "Лицензия на оружие", "Трудовая книжка"],
  Книги: ["Правила дорожного движения", "Кулинарная книга", "Справочник рыбака"],
  "Личные вещи": ["Телефон", "Кошелёк", "Часы", "Рюкзак", "Очки"],
  Продукция: ["Доска", "Металлический лист", "Слиток", "Ящик с продукцией"],
  Материалы: ["Дерево", "Железная руда", "Медная руда", "Уголь", "Ткань"],
  Одежда: ["Футболка", "Джинсы", "Кроссовки", "Куртка", "Кепка"],
  Мусор: ["Пустая бутылка", "Старая шина", "Консервная банка", "Рваная сеть"],
  "Сельское хозяйство": ["Семена пшеницы", "Пшеница", "Картофель", "Удобрение"],
  Стафф: ["Наручники", "Дубинка", "Служебный жетон"],
  Ингредиенты: ["Мука", "Сахар", "Соль", "Яйцо", "Специи"],
  Броня: ["Лёгкий бронежилет", "Тяжёлый бронежилет", "Каска"],
  Разное: ["Подарочная коробка", "Монета", "Загадочный предмет"],
};

export const seedItems: Item[] = (() => {
  let id = 0;
  return (Object.keys(seed) as ItemCategory[]).flatMap((category) =>
    seed[category].map((name) => ({ id: ++id, name, category, flags: defaultItemFlags })),
  );
})();

const categoryOrder = new Map<string, number>(categories.map((category, index) => [category, index]));

export const compareByCategory = (a: Item, b: Item) =>
  (categoryOrder.get(a.category) ?? 0) - (categoryOrder.get(b.category) ?? 0);

/** «1 предмет», «2 предмета», «5 предметов» */
export function pluralItems(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "предмет";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "предмета";
  return "предметов";
}

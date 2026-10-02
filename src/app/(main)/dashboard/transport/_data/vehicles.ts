export const categories = [
  "Все",
  "Легковые",
  "Грузовые",
  "Мототехника",
  "Велосипеды",
  "Вертолеты",
  "Самолеты",
  "Водный транспорт",
] as const;

export type Category = (typeof categories)[number];
export type VehicleCategory = Exclude<Category, "Все">;
export type FuelType = "Premium" | "Plus" | "Regular" | "Diesel" | "Electro" | "Нет";

export type UpgradeLevel = { level: number; price: number; bonus?: string };

export type VehicleUpgrade = {
  name: string;
  description: string;
  total: number;
  /** Уровни улучшения (двигатель, коробка, турбо, тормоза). */
  levels?: UpgradeLevel[];
  /** Настройки подвески: название, описание, цена и значение по умолчанию. */
  options?: { name: string; description: string; price: number; value: string }[];
};

export type PlateDesign = { name: string; source?: string };

export type Vehicle = {
  /** Уникальный ID — используется в адресе страницы: /dashboard/transport/[code] */
  code: string;
  name: string;
  model: string;
  category: VehicleCategory;
  speed: number;
  tunedSpeed: number;
  /** Гос. стоимость */
  price: number;
  /** Стоимость свалки. Если не указана — считается как половина гос. стоимости. */
  scrapPrice?: number;
  /** Источники получения (кейсы, салон, магазин и т. д.) */
  sources: string[];
  fuel: FuelType;
  /** Вместимость багажника, кг */
  trunkKg: number;
  /** Грузоподъёмность для грузовых, т */
  loadTons?: number;
  transferable: boolean;
  driftChip: boolean;
  nitro: boolean;
  isNew?: boolean;
  /** Путь к картинке: локальный (/images/transport/...) или внешний URL */
  imageUrl?: string;
  upgrades?: VehicleUpgrade[];
  /** Сколько колёс доступно по типам резины */
  wheels?: { type: string; count: number }[];
  plates?: PlateDesign[];
};

export const vehicles: Vehicle[] = [
  {
    code: "genesisg90",
    name: "Superior",
    model: "90G",
    category: "Легковые",
    speed: 290,
    tunedSpeed: 325,
    price: 17000000,
    sources: ["Majestic Премиум"],
    fuel: "Premium",
    trunkKg: 100,
    transferable: true,
    driftChip: false,
    nitro: true,
    isNew: true,
    imageUrl: "/images/transport/genesis-g90.png",
  },
  {
    code: "boattail",
    name: "Merlin",
    model: "Boat Tayl",
    category: "Водный транспорт",
    speed: 300,
    tunedSpeed: 335,
    price: 20000000,
    sources: ["Majestic Премиум"],
    fuel: "Premium",
    trunkKg: 70,
    transferable: true,
    driftChip: false,
    nitro: true,
    isNew: true,
  },
  {
    code: "brouillard",
    name: "Molsheim",
    model: "Brouillurd",
    category: "Легковые",
    speed: 340,
    tunedSpeed: 375,
    price: 29000000,
    scrapPrice: 14500000,
    sources: ["Осенний кейс 2026"],
    fuel: "Premium",
    trunkKg: 30,
    transferable: true,
    driftChip: false,
    nitro: true,
    isNew: true,
    imageUrl:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/brouillard%20%281%29-3P4djLCkJewWt2DxPOrM5UPSYqW885.png",
    upgrades: [
      {
        name: "Двигатель",
        description: "Увеличивает максимальную скорость и ускорение",
        total: 2679600,
        levels: [{ level: 4, price: 957000, bonus: "+20 км/ч" }],
      },
      {
        name: "Коробка",
        description: "Улучшает переключение передач и разгон",
        total: 861300,
        levels: [{ level: 3, price: 382800, bonus: "+12 км/ч" }],
      },
      {
        name: "Турбо",
        description: "Добавляет кратковременное ускорение",
        total: 733700,
        levels: [{ level: 1, price: 733700, bonus: "+2 км/ч" }],
      },
      {
        name: "Тормоза",
        description: "Улучшает эффективность торможения",
        total: 430650,
        levels: [{ level: 3, price: 191400 }],
      },
      {
        name: "Передняя колесная база",
        description: "Настройка передней подвески автомобиля",
        total: 37500,
        options: [
          {
            name: "Отрицательный развал",
            description: "Наклон колес внутрь для лучшего сцепления",
            price: 30000,
            value: "100%",
          },
          { name: "Настройка высоты", description: "Регулировка высоты подвески", price: 7500, value: "100%" },
        ],
      },
      {
        name: "Задняя колесная база",
        description: "Настройка задней подвески автомобиля",
        total: 37500,
        options: [
          {
            name: "Отрицательный развал",
            description: "Наклон колес внутрь для лучшего сцепления",
            price: 30000,
            value: "100%",
          },
          { name: "Настройка высоты", description: "Регулировка высоты подвески", price: 7500, value: "100%" },
        ],
      },
    ],
    wheels: [
      { type: "Низкопрофильная резина", count: 78 },
      { type: "Обычная резина", count: 69 },
      { type: "Толстая резина", count: 19 },
      { type: "Внедорожная резина", count: 8 },
    ],
    plates: [
      { name: "Wanted", source: "Зимний пропуск 2025" },
      { name: "Quiet", source: "Зимний пропуск 2025" },
      { name: "Wondow", source: "Зимний пропуск 2025" },
      { name: "Cyber", source: "Зимний пропуск 2025" },
      { name: "Christmas", source: "Зимняя сказка 2025" },
      { name: "N.E.O Tribal", source: "Формула весны 2025" },
      { name: "Spring Sakura", source: "Формула весны 2025" },
      { name: "Flowers", source: "Летний пропуск 2025" },
      { name: "Isometrics", source: "Летний пропуск 2025" },
      { name: "Vice City", source: "Летний пропуск 2025" },
      { name: "Los Angels", source: "Летний пропуск 2025" },
      { name: "Autumn Fall", source: "Осенний кейс 2025" },
      { name: "GUCHI", source: "Осенний кейс 2025" },
      { name: "The Dead Are Here", source: "Хэллоуин 2025" },
      { name: "White Rose", source: "Зимний пропуск 2026" },
      { name: "Glassery", source: "Зимний пропуск 2026" },
      { name: "Winter Drops", source: "Зимний пропуск 2026" },
      { name: "Deore", source: "Зимний пропуск 2026" },
      { name: "Silence Japan", source: "Весенний кейс 2026" },
      { name: "Superman", source: "Весенний кейс 2026" },
      { name: "ANGEL's" },
      { name: "B&W" },
      { name: "Pussy Cats" },
      { name: "Chrome Cres" },
      { name: "Unreachable" },
      { name: "I'm a Girl" },
      { name: "Japanis Sunrise", source: "Летний пропуск 2026" },
      { name: "Alter Dimenshion", source: "Летний пропуск 2026" },
      { name: "All-White", source: "Летний пропуск 2026" },
      { name: "Sunset Vibes", source: "Летний пропуск 2026" },
      { name: "US Amrican", source: "Летний пропуск 2026" },
      { name: "STARZ", source: "Летний пропуск 2026" },
      { name: "Fine Lines", source: "Осенний кейс 2026" },
      { name: "Crazy Sh1tt", source: "Осенний кейс 2026" },
      { name: "DEDNET", source: "Осенний кейс 2026" },
      { name: "Bandana", source: "Осенний кейс 2026" },
    ],
  },
  {
    code: "cascadia",
    name: "Freightways",
    model: "Cuscadia II",
    category: "Грузовые",
    speed: 135,
    tunedSpeed: 170,
    price: 20000000,
    sources: ["Осенний кейс 2026"],
    fuel: "Premium",
    trunkKg: 0,
    loadTons: 24,
    transferable: true,
    driftChip: false,
    nitro: false,
    isNew: true,
  },
  {
    code: "banshee",
    name: "Bravado",
    model: "Banshee 900R",
    category: "Легковые",
    speed: 265,
    tunedSpeed: 302,
    price: 8500000,
    sources: ["Автосалон"],
    fuel: "Plus",
    trunkKg: 60,
    transferable: true,
    driftChip: false,
    nitro: true,
  },
  {
    code: "shotaro",
    name: "Nagasaki",
    model: "Shotaro",
    category: "Мототехника",
    speed: 285,
    tunedSpeed: 320,
    price: 12000000,
    sources: ["Автосалон"],
    fuel: "Premium",
    trunkKg: 0,
    transferable: true,
    driftChip: false,
    nitro: true,
  },
  {
    code: "zentorno",
    name: "Pegassi",
    model: "Zentorno",
    category: "Легковые",
    speed: 275,
    tunedSpeed: 310,
    price: 9200000,
    sources: ["Автосалон"],
    fuel: "Premium",
    trunkKg: 40,
    transferable: true,
    driftChip: false,
    nitro: true,
  },
  {
    code: "bmx",
    name: "BMX",
    model: "BMX",
    category: "Велосипеды",
    speed: 45,
    tunedSpeed: 55,
    price: 15000,
    sources: ["Магазин"],
    fuel: "Нет",
    trunkKg: 0,
    transferable: true,
    driftChip: false,
    nitro: false,
  },
];

/** Типы покраски (общие для всего транспорта). */
export const paintGroups: { name: string; types: string[] }[] = [
  {
    name: "Основная покраска",
    types: [
      "Яркий металлик",
      "Металлик",
      "Насыщенный металлик",
      "Темный металлик",
      "Матовый",
      "Матовый металл",
      "Сатин",
      "Металл",
      "Теневой хром",
      "Чистый хром",
    ],
  },
];

export const formatPrice = (price: number) => `$${price.toLocaleString("ru-RU")}`;

export const vehicleTitle = (vehicle: Vehicle) => `${vehicle.name} ${vehicle.model}`;

export const getScrapPrice = (vehicle: Vehicle) => vehicle.scrapPrice ?? Math.round(vehicle.price / 2);

export const getVehicle = (code: string) => vehicles.find((vehicle) => vehicle.code === code);

export const formatTrunk = (vehicle: Vehicle) =>
  vehicle.loadTons ? `${vehicle.trunkKg} кг · ${vehicle.loadTons} т` : `${vehicle.trunkKg} кг`;

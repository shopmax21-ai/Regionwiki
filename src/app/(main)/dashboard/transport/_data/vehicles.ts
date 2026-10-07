export const vehicleCategories = [
  "Легковые",
  "Грузовые",
  "Мототехника",
  "Велосипеды",
  "Вертолеты",
  "Самолеты",
  "Водный транспорт",
] as const;

export const categories = ["Все", ...vehicleCategories] as const;

export type Category = (typeof categories)[number];
export type VehicleCategory = Exclude<Category, "Все">;
export const fuelTypes = ["АИ-92", "АИ-95", "АИ-98", "АИ-100", "ДТ", "Электро", "Нет"] as const;
export type FuelType = (typeof fuelTypes)[number];

export type PlateDesign = {
  name: string;
  source?: string;
};

export type UpgradeLevel = {
  /** Цена установки именно этого уровня */
  price: number;
  /** Прирост, который даёт уровень (если известен) */
  bonus?: string;
};

export type VehicleUpgrade = {
  name: string;
  description: string;
  /** Уровни по порядку: levels[0] — первый уровень, последний — максимальный */
  levels: UpgradeLevel[];
};

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
    fuel: "АИ-98",
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
    fuel: "АИ-98",
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
    fuel: "АИ-98",
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
        levels: [{ price: 382800 }, { price: 574200 }, { price: 765600 }, { price: 957000, bonus: "+20 км/ч" }],
      },
      {
        name: "Коробка",
        description: "Улучшает переключение передач и разгон",
        levels: [{ price: 191400 }, { price: 287100 }, { price: 382800, bonus: "+12 км/ч" }],
      },
      {
        name: "Турбо",
        description: "Добавляет кратковременное ускорение",
        levels: [{ price: 733700, bonus: "+2 км/ч" }],
      },
      {
        name: "Тормоза",
        description: "Улучшает эффективность торможения",
        levels: [{ price: 95700 }, { price: 143550 }, { price: 191400 }],
      },
    ],
  },
  {
    code: "supra-a80",
    name: "Tayota",
    model: "Supra A80",
    category: "Легковые",
    speed: 280,
    tunedSpeed: 302,
    price: 1780000,
    sources: ["Samurai Motors"],
    fuel: "АИ-95",
    trunkKg: 55,
    transferable: true,
    driftChip: false,
    nitro: false,
    imageUrl: "/images/transport/supra80.png",
    upgrades: [
      {
        name: "Двигатель",
        description: "Увеличивает максимальную скорость и ускорение",
        levels: [
          { price: 382800, bonus: "+5 км/ч" },
          { price: 574200, bonus: "+10 км/ч" },
          { price: 765600, bonus: "+15 км/ч" },
          { price: 957000, bonus: "+20 км/ч" },
        ],
      },
      {
        name: "Коробка",
        description: "Улучшает переключение передач и разгон",
        levels: [
          { price: 191400, bonus: "+4 км/ч" },
          { price: 287100, bonus: "+8 км/ч" },
          { price: 382800, bonus: "+12 км/ч" },
        ],
      },
      {
        name: "Турбо",
        description: "Добавляет кратковременное ускорение",
        levels: [{ price: 733700, bonus: "+2 км/ч" }],
      },
      {
        name: "Тормоза",
        description: "Улучшает эффективность торможения",
        levels: [{ price: 95700 }, { price: 143550 }, { price: 191400 }],
      },
    ],
  },
  {
    code: "camry70",
    name: "Tayota",
    model: "Camry 70",
    category: "Легковые",
    speed: 210,
    tunedSpeed: 302,
    price: 1780000,
    sources: ["Samurai Motors"],
    fuel: "АИ-95",
    trunkKg: 90,
    transferable: true,
    driftChip: false,
    nitro: false,
    imageUrl: "/images/transport/camry.png",
    upgrades: [
      {
        name: "Двигатель",
        description: "Увеличивает максимальную скорость и ускорение",
        levels: [
          { price: 382800, bonus: "+5 км/ч" },
          { price: 574200, bonus: "+10 км/ч" },
          { price: 765600, bonus: "+15 км/ч" },
          { price: 957000, bonus: "+20 км/ч" },
        ],
      },
      {
        name: "Коробка",
        description: "Улучшает переключение передач и разгон",
        levels: [
          { price: 191400, bonus: "+4 км/ч" },
          { price: 287100, bonus: "+8 км/ч" },
          { price: 382800, bonus: "+12 км/ч" },
        ],
      },
      {
        name: "Турбо",
        description: "Добавляет кратковременное ускорение",
        levels: [{ price: 733700, bonus: "+2 км/ч" }],
      },
      {
        name: "Тормоза",
        description: "Улучшает эффективность торможения",
        levels: [{ price: 95700 }, { price: 143550 }, { price: 191400 }],
      },
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
    fuel: "АИ-98",
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
    fuel: "АИ-95",
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
    fuel: "АИ-98",
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
    fuel: "АИ-98",
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

export type PaintColor = { name: string; hex: string };

/** Палитра покраски (общая для всего транспорта). */
export const paintColors: PaintColor[] = [
  { name: "Чёрный", hex: "#111111" },
  { name: "Графит", hex: "#3b3f45" },
  { name: "Серебристый", hex: "#a8adb3" },
  { name: "Белый", hex: "#f4f4f2" },
  { name: "Красный", hex: "#d62828" },
  { name: "Бордовый", hex: "#6d1a24" },
  { name: "Оранжевый", hex: "#f77f00" },
  { name: "Жёлтый", hex: "#f7c600" },
  { name: "Золотой", hex: "#c9a227" },
  { name: "Салатовый", hex: "#8ac926" },
  { name: "Зелёный", hex: "#2e8b57" },
  { name: "Тёмно-зелёный", hex: "#1b4332" },
  { name: "Бирюзовый", hex: "#1fb5ad" },
  { name: "Голубой", hex: "#4cc9f0" },
  { name: "Синий", hex: "#2b59c3" },
  { name: "Тёмно-синий", hex: "#14213d" },
  { name: "Фиолетовый", hex: "#7b2cbf" },
  { name: "Розовый", hex: "#ff6fb5" },
  { name: "Коричневый", hex: "#6f4518" },
  { name: "Бежевый", hex: "#d9c5a0" },
];

export const formatPrice = (price: number) => `$${price.toLocaleString("ru-RU")}`;

export const vehicleTitle = (vehicle: Vehicle) => `${vehicle.name} ${vehicle.model}`;

export const getScrapPrice = (vehicle: Vehicle) => vehicle.scrapPrice ?? Math.round(vehicle.price / 2);

export const formatTrunk = (vehicle: Vehicle) =>
  vehicle.loadTons ? `${vehicle.trunkKg} кг · ${vehicle.loadTons} т` : `${vehicle.trunkKg} кг`;

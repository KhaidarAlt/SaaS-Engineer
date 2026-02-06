export type CatalogTemplateType = "universal" | "fashion" | "food";

export interface TemplateFieldConfig {
  fieldName: string;
  label: string;
  type: "text" | "number" | "select" | "multiselect" | "json" | "textarea" | "array";
  required?: boolean;
  options?: string[];
  placeholder?: string;
  section: "main" | "attributes" | "nutrition";
}

export interface CatalogTemplate {
  id: CatalogTemplateType;
  name: string;
  description: string;
  icon: string; // lucide icon name
  features: string[];
  productFields: TemplateFieldConfig[];
  aiRole: {
    defaultPrompt: string;
    roleName: string;
  };
  wauFeatures: { id: string; label: string; description: string }[];
}

export const UNIT_OPTIONS = [
  { value: "шт", label: "Штуки (шт)" },
  { value: "кг", label: "Килограммы (кг)" },
  { value: "г", label: "Граммы (г)" },
  { value: "м", label: "Метры (м)" },
  { value: "см", label: "Сантиметры (см)" },
  { value: "пог.м", label: "Погонные метры (пог.м)" },
  { value: "м²", label: "Квадратные метры (м²)" },
  { value: "л", label: "Литры (л)" },
];

export const CATALOG_TEMPLATES: Record<CatalogTemplateType, CatalogTemplate> = {
  universal: {
    id: "universal",
    name: "Универсальный",
    description: "Техника, мебель, запчасти и любые товары. Единицы измерения, характеристики, цвета, теги.",
    icon: "Package",
    features: [
      "Единицы измерения (шт, кг, м, л и др.)",
      "Характеристики товара",
      "Цвета и теги",
      "Управление остатками",
    ],
    productFields: [
      { fieldName: "brand", label: "Бренд", type: "text", section: "attributes", placeholder: "Название бренда" },
      { fieldName: "unitOfMeasure", label: "Единица измерения", type: "select", section: "main", options: ["шт", "кг", "г", "м", "см", "пог.м", "м²", "л"] },
      { fieldName: "specs", label: "Характеристики", type: "json", section: "attributes" },
      { fieldName: "colors", label: "Цвета", type: "json", section: "attributes" },
      { fieldName: "tags", label: "Теги", type: "array", section: "attributes" },
    ],
    aiRole: {
      roleName: "AI Консультант",
      defaultPrompt: "Вы — консультант по товарам. Помогайте клиентам с выбором, сравнением и техническими вопросами. Отвечайте профессионально и по существу.",
    },
    wauFeatures: [
      { id: "ai_consultant", label: "AI Консультант", description: "Помощь в выборе товара" },
      { id: "comparison", label: "Сравнение товаров", description: "Сравнение характеристик" },
      { id: "tech_advice", label: "Техническая консультация", description: "Ответы на технические вопросы" },
    ],
  },
  fashion: {
    id: "fashion",
    name: "Fashion",
    description: "Одежда, обувь и аксессуары. Размеры по возрасту, пол, подбор образов, стилист.",
    icon: "Shirt",
    features: [
      "Пол и тип (одежда/обувь/аксессуары)",
      "Размерные сетки по возрасту",
      "Цвета и материалы",
      "Вертикальная витрина 9:16",
    ],
    productFields: [
      { fieldName: "gender", label: "Пол", type: "select", section: "attributes", options: ["Мужской", "Женский", "Унисекс", "Детский"] },
      { fieldName: "sizes", label: "Размеры", type: "json", section: "attributes" },
      { fieldName: "colors", label: "Цвета", type: "json", section: "attributes" },
      { fieldName: "sizeColorStock", label: "Остатки по размерам и цветам", type: "json", section: "attributes" },
      { fieldName: "tags", label: "Теги", type: "array", section: "attributes" },
    ],
    aiRole: {
      roleName: "AI Стилист",
      defaultPrompt: "Вы — стилист-консультант. Помогайте подбирать образы, советуйте размеры, предлагайте сочетания. Общайтесь дружелюбно и вдохновляюще.",
    },
    wauFeatures: [
      { id: "ai_stylist", label: "AI Стилист", description: "Подбор образов и стиля" },
      { id: "size_quiz", label: "Квиз размеров", description: "Определение размера по параметрам" },
      { id: "look_builder", label: "Конструктор образов", description: "Создание комплектов" },
      { id: "social_triggers", label: "Социальные триггеры", description: "Отзывы, популярность, тренды" },
    ],
  },
  food: {
    id: "food",
    name: "Food",
    description: "Рестораны, кафе, доставка еды. Ингредиенты, модификаторы, порции, время приготовления.",
    icon: "UtensilsCrossed",
    features: [
      "Состав и ингредиенты",
      "Модификаторы (добавки, соусы)",
      "Размер порции и вес",
      "Время приготовления и КБЖУ",
    ],
    productFields: [
      { fieldName: "ingredients", label: "Состав / Ингредиенты", type: "textarea", section: "nutrition", placeholder: "Перечислите ингредиенты" },
      { fieldName: "modifiers", label: "Модификаторы", type: "json", section: "nutrition" },
      { fieldName: "portionSize", label: "Размер порции", type: "text", section: "nutrition", placeholder: "Например: 250 мл, 350 г" },
      { fieldName: "weight", label: "Вес", type: "text", section: "nutrition", placeholder: "Например: 450 г" },
      { fieldName: "cookingTime", label: "Время приготовления (мин)", type: "number", section: "nutrition" },
      { fieldName: "calories", label: "Калорийность (ккал)", type: "number", section: "nutrition" },
      { fieldName: "allergens", label: "Аллергены", type: "array", section: "nutrition" },
      { fieldName: "tags", label: "Теги", type: "array", section: "attributes" },
    ],
    aiRole: {
      roleName: "AI Официант",
      defaultPrompt: "Вы — вежливый официант-консультант. Помогайте с выбором блюд, предлагайте дополнения, учитывайте аллергии и предпочтения. Общайтесь тепло и заботливо.",
    },
    wauFeatures: [
      { id: "ai_waiter", label: "AI Официант", description: "Помощь с выбором блюд" },
      { id: "repeat_order", label: "Повторный заказ", description: "Быстрый повтор прошлого заказа" },
      { id: "group_dinner", label: "Групповой ужин", description: "Сбор заказа на компанию" },
      { id: "smart_upsell", label: "Умный допродаж", description: "Рекомендации дополнений" },
    ],
  },
};

export function getTemplateById(id: CatalogTemplateType): CatalogTemplate {
  return CATALOG_TEMPLATES[id] || CATALOG_TEMPLATES.universal;
}

import catalogCsv from './requestCatalog.csv?raw';

export type CatalogProduct = {
  id: string;
  name: string;
  unit: string;
  weeklyNorm: number;
  step: number;
};

export type CatalogSubcategory = {
  id: string;
  label: string;
  icon: string;
  products: CatalogProduct[];
};

export type CatalogMainCategory = {
  id: string;
  label: string;
  icon: string;
  description?: string;
  subcategories: CatalogSubcategory[];
};

const mainCategoryMeta: Record<string, { id: string; label: string; icon: string }> = {
  'Мясо и мясная гастрономия': { id: 'meat', label: 'Мясо', icon: '🥩' },
  'Рыба и морепродукты': { id: 'fish', label: 'Рыба', icon: '🐟' },
  'Молочные продукты и яйцо': { id: 'dairy', label: 'Молочка', icon: '🧀' },
  'Овощи, фрукты, грибы и зелень': { id: 'vegetables', label: 'Овощи', icon: '🥬' },
  'Бакалея и сухие склады': { id: 'dry-goods', label: 'Бакалея', icon: '🌾' },
  Заморозка: { id: 'frozen', label: 'Заморозка', icon: '❄️' },
  'Консервация и соусы': { id: 'sauces', label: 'Соусы', icon: '🥫' },
  'Специи и сухие добавки': { id: 'spices', label: 'Специи', icon: '🧂' },
  'Хлеб и выпечка': { id: 'bakery', label: 'Хлеб', icon: '🍞' },
};

const subcategoryLabelMeta: Record<string, { label: string; icon: string }> = {
  Говядина: { label: 'Говядина', icon: '🥩' },
  Свинина: { label: 'Свинина', icon: '🐖' },
  'Птица и кролик': { label: 'Птица', icon: '🐓' },
  Баранина: { label: 'Баранина', icon: '🐑' },
  'Фарши и полуфабрикаты': { label: 'Фарши', icon: '🍖' },
  'Мясные деликатесы и колбасы': { label: 'Колбасы', icon: '🥓' },
  Рыба: { label: 'Рыба', icon: '🐟' },
  Морепродукты: { label: 'Морепродукты', icon: '🦐' },
  'Икра и водоросли': { label: 'Икра и нори', icon: '🍣' },
  'Молоко и сливки': { label: 'Молоко', icon: '🥛' },
  Сыры: { label: 'Сыры', icon: '🧀' },
  Яйцо: { label: 'Яйцо', icon: '🥚' },
  'Овощи и корнеплоды': { label: 'Овощи', icon: '🥕' },
  'Фрукты и ягоды': { label: 'Фрукты', icon: '🍎' },
  Грибы: { label: 'Грибы', icon: '🍄' },
  'Зелень и травы': { label: 'Зелень', icon: '🌿' },
  'Крупы и бобовые': { label: 'Крупы', icon: '🌾' },
  'Мука и макаронные изделия': { label: 'Мука и паста', icon: '🍝' },
  'Орехи, семечки, сухофрукты': { label: 'Орехи', icon: '🥜' },
  'Сахар и кондитерское': { label: 'Кондитерка', icon: '🍫' },
  'Ягоды и фрукты': { label: 'Ягоды', icon: '🫐' },
  Пюре: { label: 'Пюре', icon: '🥭' },
  'Овощная консервация': { label: 'Консервация', icon: '🫙' },
  'Соусы и заправки': { label: 'Соусы', icon: '🥣' },
  'Масла и уксусы': { label: 'Масла', icon: '🫒' },
  Специи: { label: 'Специи', icon: '🧂' },
  'Бульоны сухие': { label: 'Бульоны', icon: '🍜' },
  'Хлеб и выпечка': { label: 'Хлеб', icon: '🥖' },
};

const transliterationMap: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .split('')
    .map((char) => transliterationMap[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const parseNumber = (value: string) => Number(value.replace(',', '.'));

const parseCatalog = (): CatalogMainCategory[] => {
  const rows = catalogCsv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(';').map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 7);

  const categories = new Map<string, CatalogMainCategory>();

  rows.forEach(([mainCategoryName, subcategoryName, productName, unit, weeklyNormValue, , stepValue]) => {
    const mainMeta = mainCategoryMeta[mainCategoryName] ?? {
      id: slugify(mainCategoryName),
      label: mainCategoryName,
      icon: '📦',
    };

    const subMeta = subcategoryLabelMeta[subcategoryName] ?? {
      label: subcategoryName,
      icon: '📁',
    };

    let category = categories.get(mainCategoryName);

    if (!category) {
      category = {
        id: mainMeta.id,
        label: mainMeta.label,
        icon: mainMeta.icon,
        description: mainCategoryName,
        subcategories: [],
      };
      categories.set(mainCategoryName, category);
    }

    let subcategory = category.subcategories.find((entry) => entry.id === slugify(subcategoryName));

    if (!subcategory) {
      subcategory = {
        id: slugify(subcategoryName),
        label: subMeta.label,
        icon: subMeta.icon,
        products: [],
      };
      category.subcategories.push(subcategory);
    }

    subcategory.products.push({
      id: slugify(`${mainCategoryName}-${subcategoryName}-${productName}`),
      name: productName,
      unit,
      weeklyNorm: parseNumber(weeklyNormValue),
      step: parseNumber(stepValue),
    });
  });

  return Array.from(categories.values());
};

export const kitchenRequestCatalogDemo = parseCatalog();

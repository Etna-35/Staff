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

export const kitchenRequestCatalogDemo: {
  id: string;
  label: string;
  icon: string;
  subcategories: CatalogSubcategory[];
} = {
  id: 'meat',
  label: 'Мясо и мясная гастрономия',
  icon: '🥩',
  subcategories: [
    {
      id: 'beef',
      label: 'Говядина',
      icon: '🥩',
      products: [
        { id: 'beef-tenderloin', name: 'Говядина вырезка', weeklyNorm: 4, step: 0.5, unit: 'кг' },
        { id: 'beef-shoulder', name: 'Говядина лопатка', weeklyNorm: 6, step: 1, unit: 'кг' },
        { id: 'beef-skirt', name: 'Говядина мачете', weeklyNorm: 5, step: 1, unit: 'кг' },
        { id: 'beef-cheeks', name: 'Говядина щеки', weeklyNorm: 8, step: 2, unit: 'шт' },
      ],
    },
    {
      id: 'pork',
      label: 'Свинина',
      icon: '🐖',
      products: [
        { id: 'pork-ribs', name: 'Свинина ребра', weeklyNorm: 6, step: 1, unit: 'кг' },
        { id: 'pork-neck', name: 'Свинина шея', weeklyNorm: 5, step: 1, unit: 'кг' },
        { id: 'smalets', name: 'Смалец', weeklyNorm: 3, step: 1, unit: 'вед.' },
      ],
    },
    {
      id: 'poultry',
      label: 'Птица и кролик',
      icon: '🐓',
      products: [
        { id: 'chicken-wings', name: 'Крылья куриные', weeklyNorm: 8, step: 1, unit: 'кг' },
        { id: 'whole-chicken', name: 'Курица тушка', weeklyNorm: 10, step: 2, unit: 'шт' },
        {
          id: 'duck-breast',
          name: 'Утка филе грудки на коже',
          weeklyNorm: 12,
          step: 2,
          unit: 'шт',
        },
        { id: 'chicken-fillet', name: 'Филе курицы', weeklyNorm: 10, step: 1, unit: 'кг' },
      ],
    },
    {
      id: 'lamb',
      label: 'Баранина',
      icon: '🐑',
      products: [
        { id: 'lamb-leg', name: 'Баранина окорок', weeklyNorm: 3, step: 1, unit: 'шт' },
        { id: 'lamb-rack', name: 'Каре ягненка', weeklyNorm: 6, step: 1, unit: 'шт' },
        { id: 'fat-tail', name: 'Курдюк', weeklyNorm: 2, step: 0.5, unit: 'кг' },
      ],
    },
    {
      id: 'minced',
      label: 'Фарши и полуфабрикаты',
      icon: '🍖',
      products: [
        { id: 'minced-beef', name: 'Фарш говядина', weeklyNorm: 5, step: 1, unit: 'кг' },
        { id: 'minced-chicken', name: 'Фарш куриный', weeklyNorm: 4, step: 1, unit: 'кг' },
        {
          id: 'minced-mix',
          name: 'Фарш свинина-говядина',
          weeklyNorm: 6,
          step: 1,
          unit: 'кг',
        },
      ],
    },
    {
      id: 'deli',
      label: 'Деликатесы и колбасы',
      icon: '🥓',
      products: [
        { id: 'bacon-sliced', name: 'Бекон нарезка', weeklyNorm: 6, step: 1, unit: 'уп.' },
        { id: 'ham', name: 'Ветчина', weeklyNorm: 3, step: 1, unit: 'бат.' },
        { id: 'pepperoni', name: 'Пеперони', weeklyNorm: 4, step: 1, unit: 'пал.' },
        { id: 'salami', name: 'Салями', weeklyNorm: 4, step: 1, unit: 'пал.' },
        { id: 'cervelat', name: 'Сервелат', weeklyNorm: 3, step: 1, unit: 'пал.' },
        {
          id: 'smoked-duck',
          name: 'Утка сырокопченая',
          weeklyNorm: 5,
          step: 1,
          unit: 'уп.',
        },
      ],
    },
  ],
};

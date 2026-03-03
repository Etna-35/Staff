import { useEffect, useMemo, useState } from 'react';
import { kitchenRequestCatalogDemo } from '../data/requestCatalog';
import { useAppStore } from '../store/useAppStore';
import type { RequestCategory } from '../types/domain';
import {
  Card,
  Pill,
  PrimaryButton,
  SectionTitle,
  SecondaryButton,
  Textarea,
} from '../components/ui';

const requestOptions: { key: RequestCategory; label: string }[] = [
  { key: 'kitchen', label: 'Кухня' },
  { key: 'bar', label: 'Бар' },
  { key: 'supplies', label: 'Хозка' },
];

const requestCategoryLabels: Record<RequestCategory, string> = {
  kitchen: 'Кухня',
  bar: 'Бар',
  supplies: 'Хозка',
};

const monthLabels = [
  'Января',
  'Февраля',
  'Марта',
  'Апреля',
  'Мая',
  'Июня',
  'Июля',
  'Августа',
  'Сентября',
  'Октября',
  'Ноября',
  'Декабря',
];

const formatAmount = (value: number) => {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return String(Number(value.toFixed(2))).replace('.', ',');
};

const formatQuantity = (value: number, unit: string) => `${formatAmount(value)} ${unit}`;

const roundToStep = (value: number) => Math.round(value * 100) / 100;

const getLocalDateKey = (value: string) => {
  const date = new Date(value);

  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const formatRequestDate = (value: string) => {
  const date = new Date(value);

  return `${date.getDate()} ${monthLabels[date.getMonth()]}`;
};

export const RequestsScreen = () => {
  const { requests, submitRequest } = useAppStore();
  const [category, setCategory] = useState<RequestCategory>('kitchen');
  const [catalogComment, setCatalogComment] = useState('');
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [overLimitConfirmed, setOverLimitConfirmed] = useState(false);
  const [selectedMainCategoryId, setSelectedMainCategoryId] = useState(
    kitchenRequestCatalogDemo[0]?.id ?? '',
  );
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(
    kitchenRequestCatalogDemo[0]?.subcategories[0]?.id ?? '',
  );
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});

  const selectedMainCategory =
    kitchenRequestCatalogDemo.find((entry) => entry.id === selectedMainCategoryId) ??
    kitchenRequestCatalogDemo[0];

  const catalogProducts = useMemo(
    () =>
      kitchenRequestCatalogDemo.flatMap((mainCategory) =>
        mainCategory.subcategories.flatMap((subcategory) =>
          subcategory.products.map((product) => ({
            ...product,
            mainCategoryId: mainCategory.id,
            mainCategoryLabel: mainCategory.label,
            subcategoryId: subcategory.id,
            subcategoryLabel: subcategory.label,
            subcategoryIcon: subcategory.icon,
          })),
        ),
      ),
    [],
  );

  const selectedSubcategory =
    selectedMainCategory?.subcategories.find((entry) => entry.id === selectedSubcategoryId) ??
    selectedMainCategory?.subcategories[0];

  const selectedItems = useMemo(
    () =>
      catalogProducts
        .map((product) => ({
          ...product,
          quantity: selectedQuantities[product.id] ?? 0,
        }))
        .filter((product) => product.quantity > 0),
    [catalogProducts, selectedQuantities],
  );

  const overLimitItems = useMemo(
    () => selectedItems.filter((product) => product.quantity > product.weeklyNorm),
    [selectedItems],
  );
  const overLimitSignature = useMemo(
    () =>
      overLimitItems
        .map((product) => `${product.id}:${product.quantity}`)
        .sort()
        .join('|'),
    [overLimitItems],
  );

  const groupedSelectedItems = useMemo(() => {
    const groups = new Map<
      string,
      { label: string; icon: string; items: typeof selectedItems }
    >();

    selectedItems.forEach((product) => {
      const existing = groups.get(product.subcategoryId);

      if (existing) {
        existing.items.push(product);
        return;
      }

      groups.set(product.subcategoryId, {
        label: product.subcategoryLabel,
        icon: product.subcategoryIcon,
        items: [product],
      });
    });

    return Array.from(groups.values());
  }, [selectedItems]);

  const requestHistoryRows = useMemo(() => {
    const uniqueRows = new Map<
      string,
      { id: string; category: RequestCategory; createdAt: string }
    >();

    [...requests]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .forEach((request) => {
        const key = `${request.category}:${getLocalDateKey(request.createdAt)}`;

        if (!uniqueRows.has(key)) {
          uniqueRows.set(key, {
            id: key,
            category: request.category,
            createdAt: request.createdAt,
          });
        }
      });

    return Array.from(uniqueRows.values());
  }, [requests]);

  useEffect(() => {
    setCatalogNotice(null);

    if (category !== 'kitchen') {
      setShowSummary(false);
    }
  }, [category]);

  useEffect(() => {
    if (!selectedMainCategory) {
      setSelectedSubcategoryId('');
      return;
    }

    const firstSubcategoryId = selectedMainCategory.subcategories[0]?.id ?? '';

    setSelectedSubcategoryId((current) =>
      selectedMainCategory.subcategories.some((entry) => entry.id === current)
        ? current
        : firstSubcategoryId,
    );
  }, [selectedMainCategory]);

  useEffect(() => {
    setOverLimitConfirmed(false);
  }, [overLimitSignature]);

  const updateProductQuantity = (productId: string, step: number, direction: 1 | -1) => {
    setCatalogNotice(null);
    setSelectedQuantities((current) => {
      const nextValue = roundToStep((current[productId] ?? 0) + step * direction);

      if (nextValue <= 0) {
        const nextState = { ...current };
        delete nextState[productId];
        return nextState;
      }

      return {
        ...current,
        [productId]: nextValue,
      };
    });
  };

  const submitCatalogRequest = () => {
    if (selectedItems.length === 0) {
      return;
    }

    if (overLimitItems.length > 0 && !overLimitConfirmed) {
      return;
    }

    selectedItems.forEach((product) => {
      submitRequest({
        category: 'kitchen',
        item: product.name,
        remaining: formatQuantity(product.weeklyNorm, product.unit),
        needed: formatQuantity(product.quantity, product.unit),
        comment: [
          product.quantity > product.weeklyNorm
            ? `Повар подтвердил объем выше нормы`
            : null,
          catalogComment.trim() || null,
        ]
          .filter(Boolean)
          .join(' · '),
        requestMode: 'catalog',
        quantity: product.quantity,
        unit: product.unit,
        weeklyNorm: product.weeklyNorm,
        step: product.step,
        subgroup: product.subcategoryLabel,
      });
    });

    setSelectedQuantities({});
    setCatalogComment('');
    setShowSummary(false);
    setOverLimitConfirmed(false);
    setCatalogNotice('Заявка сохранена локально. Можно проверить список ниже.');
  };

  return (
    <div className={`space-y-4 ${category === 'kitchen' && selectedItems.length ? 'pb-28' : ''}`}>
      <div>
        <p className="text-sm text-ink/55">Заявки</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {requestOptions.map((option) => (
          <button
            key={option.key}
            className={`rounded-[1.5rem] px-3 py-4 text-sm font-semibold ${
              category === option.key ? 'bg-ink text-white' : 'bg-white/90 text-ink shadow-card'
            }`}
            onClick={() => setCategory(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {category === 'kitchen' ? (
        <>
          <Card>
            <SectionTitle title="Кухня · каталог" />
            <div className="flex gap-2 overflow-x-auto pb-1">
              {kitchenRequestCatalogDemo.map((mainCategory) => (
                <button
                  key={mainCategory.id}
                  className={`shrink-0 rounded-2xl px-4 py-4 text-left text-sm font-semibold ${
                    selectedMainCategoryId === mainCategory.id
                      ? 'bg-ink text-white'
                      : 'bg-fog text-ink'
                  }`}
                  onClick={() => setSelectedMainCategoryId(mainCategory.id)}
                >
                  <span className="mr-2 text-base">{mainCategory.icon}</span>
                  {mainCategory.label}
                </button>
              ))}
            </div>
            {selectedMainCategory?.subcategories.length ? (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {selectedMainCategory.subcategories.map((subcategory) => (
                  <button
                    key={subcategory.id}
                    className={`shrink-0 rounded-2xl px-4 py-3 text-sm font-semibold ${
                      selectedSubcategoryId === subcategory.id
                        ? 'bg-ink text-white'
                        : 'bg-fog text-ink'
                    }`}
                    onClick={() => setSelectedSubcategoryId(subcategory.id)}
                  >
                    <span className="mr-2">{subcategory.icon}</span>
                    {subcategory.label}
                  </button>
                ))}
              </div>
            ) : null}
            {selectedSubcategory?.products.length ? (
              <div className="mt-4 space-y-3">
                {selectedSubcategory.products.map((product) => {
                  const quantity = selectedQuantities[product.id] ?? 0;
                  const isOverLimit = quantity > product.weeklyNorm;

                  return (
                    <div key={product.id} className="rounded-2xl bg-fog p-4">
                      <div className="min-w-0">
                        <p className="font-semibold">{product.name}</p>
                        <p className="mt-2 text-sm text-ink/55">
                          В неделю: {formatQuantity(product.weeklyNorm, product.unit)}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl font-semibold"
                          onClick={() => updateProductQuantity(product.id, product.step, -1)}
                        >
                          -
                        </button>
                        <div className="flex-1 rounded-2xl bg-white px-4 py-3 text-center text-lg font-semibold">
                          {formatQuantity(quantity, product.unit)}
                        </div>
                        <button
                          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-xl font-semibold text-white"
                          onClick={() => updateProductQuantity(product.id, product.step, 1)}
                        >
                          +
                        </button>
                      </div>
                      {isOverLimit ? (
                        <p className="mt-3 text-sm font-medium text-amber-900">
                          Выше обычного объема. На подтверждении попросим проверить заказ.
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-fog p-4">
                <p className="font-semibold">Категория наполняется</p>
                <p className="mt-2 text-sm text-ink/60">
                  Пока для теста доступен подробный каталог по мясу. Остальные категории можно
                  заполнить позже тем же способом.
                </p>
              </div>
            )}
          </Card>
          {catalogNotice ? (
            <Card className="bg-pine/10">
              <p className="text-sm font-semibold text-pine">{catalogNotice}</p>
            </Card>
          ) : null}
        </>
      ) : (
        <Card>
          <SectionTitle title={category === 'bar' ? 'Бар' : 'Хозка'} />
          <div className="rounded-2xl bg-fog p-4">
            <p className="font-semibold">Раздел в работе</p>
            <p className="mt-2 text-sm text-ink/60">
              Скоро здесь появится такой же каталог с быстрым набором позиций, как у кухни.
            </p>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle title="Последние заявки" />
        <div className="space-y-3">
          {requestHistoryRows.length === 0 ? (
            <p className="text-sm text-ink/55">Пока заявок нет.</p>
          ) : (
            requestHistoryRows.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-fog p-3"
              >
                <p className="font-semibold">{requestCategoryLabels[request.category]}</p>
                <p className="text-sm text-ink/55">{formatRequestDate(request.createdAt)}</p>
              </div>
            ))
          )}
        </div>
      </Card>

      {category === 'kitchen' && selectedItems.length > 0 ? (
        <div className="fixed inset-x-0 bottom-24 mx-auto max-w-md px-4">
          <div className="rounded-[1.75rem] bg-ink px-4 py-4 text-white shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-white/60">Черновик заявки</p>
                <p className="mt-1 font-semibold">Выбрано {selectedItems.length} позиций</p>
                {overLimitItems.length > 0 ? (
                  <p className="mt-1 text-xs text-citrus">
                    {overLimitItems.length} поз. выше недельной нормы
                  </p>
                ) : null}
              </div>
              <button
                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-ink"
                onClick={() => setShowSummary(true)}
              >
                Проверить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showSummary ? (
        <div className="fixed inset-0 z-20 flex items-end bg-black/30">
          <div className="w-full rounded-t-[2rem] bg-white p-5">
            <SectionTitle title="Проверьте заявку" action={<Pill>{selectedItems.length} поз.</Pill>} />
            <div className="space-y-4">
              {groupedSelectedItems.map((group) => (
                <div key={group.label} className="rounded-2xl bg-fog p-4">
                  <div className="flex items-center gap-2">
                    <span>{group.icon}</span>
                    <p className="font-semibold">{group.label}</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {group.items.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-start justify-between gap-3 rounded-2xl bg-white/80 px-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{product.name}</p>
                          <p className="mt-1 text-sm text-ink/55">
                            В неделю: {formatQuantity(product.weeklyNorm, product.unit)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {formatQuantity(product.quantity, product.unit)}
                          </p>
                          {product.quantity > product.weeklyNorm ? (
                            <p className="mt-1 text-xs font-semibold text-amber-900">
                              Выше нормы
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <Textarea
                placeholder="Комментарий к заявке"
                value={catalogComment}
                onChange={(event) => setCatalogComment(event.target.value)}
              />

              {overLimitItems.length > 0 ? (
                <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Есть заказ выше обычного объема</p>
                  <p className="mt-1">
                    Проверьте позиции и подтвердите, что это верный объем для заказа.
                  </p>
                  <label className="mt-3 flex items-start gap-2 font-medium">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={overLimitConfirmed}
                      onChange={(event) => setOverLimitConfirmed(event.target.checked)}
                    />
                    Все верно, оставляем повышенный объем
                  </label>
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex gap-3">
              <PrimaryButton
                disabled={overLimitItems.length > 0 && !overLimitConfirmed}
                onClick={submitCatalogRequest}
              >
                Подтвердить заявку
              </PrimaryButton>
              <SecondaryButton onClick={() => setShowSummary(false)}>
                Вернуться
              </SecondaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

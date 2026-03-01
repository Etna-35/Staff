import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAreaLabel, getCriticalityLabel, useAppStore } from '../store/useAppStore';
import { Card, Input, Pill, SectionTitle } from '../components/ui';
import type { HandoffArea } from '../types/domain';

const areaOrder: HandoffArea[] = ['kitchen', 'bar'];

export const HandoffScreen = () => {
  const { handoffItems, toggleHandoffItem, updateHandoffReason } = useAppStore();
  const [activeArea, setActiveArea] = useState<HandoffArea>('kitchen');

  const grouped = useMemo(
    () =>
      areaOrder.map((area) => ({
        area,
        items: handoffItems.filter((item) => item.area === area),
      })),
    [handoffItems],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink/55">Передача</p>
          <h1 className="font-display text-2xl font-semibold">Утро без потерь контекста</h1>
        </div>
        <Link to="/" className="rounded-2xl bg-fog px-3 py-2 text-sm font-semibold">
          Назад
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {grouped.map((group) => (
          <button
            key={group.area}
            className={`rounded-[1.4rem] px-3 py-4 text-sm font-semibold ${
              activeArea === group.area ? 'bg-ink text-white' : 'bg-white/90 text-ink shadow-card'
            }`}
            onClick={() => setActiveArea(group.area)}
          >
            {group.area === 'kitchen' ? 'Кухня: утро' : 'Бар: передача'}
          </button>
        ))}
      </div>

      {grouped
        .filter((group) => group.area === activeArea)
        .map((group) => (
          <Card key={group.area}>
            <SectionTitle
              title={
                group.area === 'kitchen'
                  ? 'Кухня: заготовки на утро'
                  : 'Бар: передача бара'
              }
              action={<Pill>{getAreaLabel(group.area)}</Pill>}
            />
            <div className="space-y-3">
              {group.items.map((item) => (
                <div key={item.id} className="rounded-2xl bg-fog p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {getCriticalityLabel(item.criticality)} {item.title}
                      </p>
                      <p className="text-sm text-ink/55">Причина обязательна для чекбокса</p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[#231f1a]"
                      checked={item.checked}
                      disabled={!item.reason.trim()}
                      onChange={() => toggleHandoffItem(item.id)}
                    />
                  </div>
                  <Input
                    className="mt-3"
                    placeholder="Причина / комментарий"
                    value={item.reason}
                    onChange={(event) => updateHandoffReason(item.id, event.target.value)}
                  />
                </div>
              ))}
            </div>
          </Card>
        ))}
    </div>
  );
};

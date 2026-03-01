import { FormEvent, useState } from 'react';
import { appLinks } from '../config/links';
import { useAppStore } from '../store/useAppStore';
import type { RequestCategory } from '../types/domain';
import { Card, Input, PrimaryButton, SectionTitle, Textarea } from '../components/ui';

const requestOptions: { key: RequestCategory; label: string }[] = [
  { key: 'kitchen', label: 'Кухня' },
  { key: 'bar', label: 'Бар' },
  { key: 'supplies', label: 'Хозка' },
];

export const RequestsScreen = () => {
  const { requests, submitRequest } = useAppStore();
  const [category, setCategory] = useState<RequestCategory>('kitchen');
  const [item, setItem] = useState('');
  const [remaining, setRemaining] = useState('');
  const [needed, setNeeded] = useState('');
  const [comment, setComment] = useState('');

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!item.trim() || !remaining.trim() || !needed.trim()) {
      return;
    }

    submitRequest({
      category,
      item: item.trim(),
      remaining: remaining.trim(),
      needed: needed.trim(),
      comment: comment.trim(),
    });

    setItem('');
    setRemaining('');
    setNeeded('');
    setComment('');
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-ink/55">Заявки</p>
        <h1 className="font-display text-2xl font-semibold">Крупно, быстро, без поиска ссылок</h1>
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

      <Card>
        <SectionTitle title="Локальная форма MVP" />
        <form className="space-y-3" onSubmit={onSubmit}>
          <Input
            placeholder="Позиция"
            value={item}
            onChange={(event) => setItem(event.target.value)}
          />
          <Input
            placeholder="Остаток"
            value={remaining}
            onChange={(event) => setRemaining(event.target.value)}
          />
          <Input
            placeholder="Нужно"
            value={needed}
            onChange={(event) => setNeeded(event.target.value)}
          />
          <Textarea
            placeholder="Комментарий"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <PrimaryButton type="submit">Сохранить заявку</PrimaryButton>
        </form>
      </Card>

      <Card>
        <SectionTitle title="Внешняя форма" />
        <a
          href={appLinks.externalRequestForms[category]}
          target="_blank"
          rel="noreferrer"
          className="block rounded-2xl bg-fog px-4 py-4 text-sm font-semibold"
        >
          Открыть Yandex Form для категории
        </a>
      </Card>

      <Card>
        <SectionTitle title="Последние заявки" />
        <div className="space-y-3">
          {requests.map((request) => (
            <div key={request.id} className="rounded-2xl bg-fog p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{request.item}</p>
                <span className="text-xs uppercase tracking-[0.2em] text-ink/45">
                  {request.category}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink/60">
                Остаток {request.remaining} → нужно {request.needed}
              </p>
              {request.comment ? (
                <p className="mt-2 text-sm text-ink/60">{request.comment}</p>
              ) : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};


import { FormEvent, useMemo, useState } from 'react';
import { getCurrentEmployee, useAppStore } from '../store/useAppStore';
import { Card, Input, Pill, PrimaryButton, SectionTitle, SecondaryButton } from '../components/ui';

const statusText = {
  assigned: 'Назначено',
  done: 'Готово',
  accepted: 'Принято',
  returned: 'Вернуть',
} as const;

const checklistMeta = {
  waiter: [
    {
      title: 'Чек-лист открытия смены',
      description: 'Подготовка зала, кассы и стартовых позиций.',
    },
    {
      title: 'Чек-лист закрытия смены',
      description: 'Сдача зала, расчетов и финального порядка.',
    },
  ],
  bartender: [
    {
      title: 'Чек-лист открытия смены',
      description: 'Подготовка бара, льда и стартовых заготовок.',
    },
    {
      title: 'Чек-лист закрытия смены',
      description: 'Передача бара, остатков и закрывающих действий.',
    },
  ],
  chef: [
    {
      title: 'Чек-лист открытия смены',
      description: 'Проверка кухни, заготовок и стартовых задач смены.',
    },
    {
      title: 'Чек-лист закрытия смены',
      description: 'Закрытие кухни, передача и финальный контроль.',
    },
  ],
} as const;

export const MissionsScreen = () => {
  const { tasks, createTask, markTaskDone, acceptTask, returnTask } = useAppStore();
  const currentEmployee = useAppStore(getCurrentEmployee);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState(currentEmployee?.fullName ?? '');
  const [points, setPoints] = useState('10');
  const [returnReasons, setReturnReasons] = useState<Record<string, string>>({});

  const pendingReview = useMemo(
    () => tasks.filter((task) => task.status === 'done'),
    [tasks],
  );

  if (currentEmployee?.role !== 'owner') {
    const checklistItems = currentEmployee ? checklistMeta[currentEmployee.role] : [];

    return (
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Задачи</h1>
        </div>
        <div className="space-y-3">
          {checklistItems.map((item) => (
            <Card key={item.title}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{item.title}</p>
                  <p className="mt-2 text-sm text-ink/60">{item.description}</p>
                </div>
                <Pill>Скоро</Pill>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const submitTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!title.trim() || !assignee.trim()) {
      return;
    }

    createTask(title.trim(), assignee.trim(), Number(points) || 0);
    setTitle('');
    setAssignee('');
    setPoints('10');
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Задачи</h1>
      </div>

      <Card>
        <SectionTitle title="Новая задача" />
        <form className="space-y-3" onSubmit={submitTask}>
          <Input
            placeholder="Что нужно сделать"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Input
            placeholder="Исполнитель"
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
          />
          <Input
            type="number"
            min="0"
            placeholder="Очки"
            value={points}
            onChange={(event) => setPoints(event.target.value)}
          />
          <PrimaryButton type="submit">Создать задачу</PrimaryButton>
        </form>
      </Card>

      <Card>
        <SectionTitle title="На приемку" action={<Pill tone="warning">{pendingReview.length}</Pill>} />
        <div className="space-y-3">
          {pendingReview.length === 0 ? (
            <p className="text-sm text-ink/55">Ничего не ждет решения.</p>
          ) : (
            pendingReview.map((task) => (
              <div key={task.id} className="rounded-2xl bg-fog p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{task.title}</p>
                    <p className="text-sm text-ink/55">{task.assignee}</p>
                  </div>
                  <Pill tone="warning">Готово</Pill>
                </div>
                <Input
                  className="mt-3"
                  placeholder="Причина возврата"
                  value={returnReasons[task.id] ?? ''}
                  onChange={(event) =>
                    setReturnReasons((current) => ({
                      ...current,
                      [task.id]: event.target.value,
                    }))
                  }
                />
                <div className="mt-3 flex gap-3">
                  <PrimaryButton className="flex-1" onClick={() => acceptTask(task.id)}>
                    Принять
                  </PrimaryButton>
                  <SecondaryButton
                    className="flex-1"
                    onClick={() => returnTask(task.id, returnReasons[task.id] ?? '')}
                  >
                    Вернуть
                  </SecondaryButton>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="space-y-3">
        {tasks.map((task) => (
          <Card key={task.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{task.title}</p>
                <p className="mt-1 text-sm text-ink/55">
                  {task.assignee} · {task.points} очков · {task.dueLabel}
                </p>
              </div>
              <Pill
                tone={
                  task.status === 'accepted'
                    ? 'success'
                    : task.status === 'returned'
                      ? 'danger'
                      : task.status === 'done'
                        ? 'warning'
                        : 'default'
                }
              >
                {statusText[task.status]}
              </Pill>
            </div>
            {task.returnReason ? (
              <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
                Причина: {task.returnReason}
              </p>
            ) : null}
            {task.status === 'assigned' || task.status === 'returned' ? (
              <div className="mt-3">
                <PrimaryButton onClick={() => markTaskDone(task.id)}>
                  Готово (сотрудник)
                </PrimaryButton>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
};

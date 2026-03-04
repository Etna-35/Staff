import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getCurrentEmployee, useAppStore } from '../store/useAppStore';
import {
  Card,
  Input,
  Pill,
  PrimaryButton,
  SectionTitle,
  SecondaryButton,
  Select,
} from '../components/ui';

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
  const loginEmployees = useAppStore((state) => state.loginEmployees);
  const refreshLoginEmployees = useAppStore((state) => state.refreshLoginEmployees);
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [points, setPoints] = useState('10');
  const [rewardAmount, setRewardAmount] = useState('0');
  const [returnReasons, setReturnReasons] = useState<Record<string, string>>({});

  const pendingReview = useMemo(
    () => tasks.filter((task) => task.status === 'done'),
    [tasks],
  );
  const assigneeOptions = useMemo(
    () => [...loginEmployees].sort((left, right) => left.fullName.localeCompare(right.fullName, 'ru')),
    [loginEmployees],
  );

  useEffect(() => {
    if (currentEmployee?.role === 'owner' && assigneeOptions.length === 0) {
      void refreshLoginEmployees();
    }
  }, [assigneeOptions.length, currentEmployee?.role, refreshLoginEmployees]);

  useEffect(() => {
    if (!assigneeId && assigneeOptions.length > 0) {
      setAssigneeId(assigneeOptions[0].id);
    }
  }, [assigneeId, assigneeOptions]);

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

    const assignee = assigneeOptions.find((employee) => employee.id === assigneeId);

    if (!title.trim() || !assignee) {
      return;
    }

    createTask({
      title: title.trim(),
      assigneeId: assignee.id,
      assigneeName: assignee.fullName,
      points: Number(points) || 0,
      rewardAmount: Number(rewardAmount) || 0,
    });
    setTitle('');
    setPoints('10');
    setRewardAmount('0');
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
          <Select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
            {assigneeOptions.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              min="0"
              placeholder="Очки"
              value={points}
              onChange={(event) => setPoints(event.target.value)}
            />
            <Input
              type="number"
              min="0"
              placeholder="Награда ₽"
              value={rewardAmount}
              onChange={(event) => setRewardAmount(event.target.value)}
            />
          </div>
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
                  {task.assignee}
                  {task.rewardAmount ? ` · ${task.rewardAmount} ₽` : ''}
                  {' · '}
                  {task.points} очков · {task.dueLabel}
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

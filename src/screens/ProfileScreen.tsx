import { appLinks } from '../config/links';
import { useAppStore } from '../store/useAppStore';
import { Card, Pill, SectionTitle, SecondaryButton } from '../components/ui';

export const ProfileScreen = () => {
  const { role, setRole, tasks, losses, resetDemo } = useAppStore();

  const acceptedTasks = tasks.filter((task) => task.status === 'accepted').length;
  const waitingTasks = tasks.filter((task) => task.status === 'done').length;
  const overdueTasks = tasks.filter((task) => task.status === 'returned').length;
  const totalPoints = tasks
    .filter((task) => task.status === 'accepted')
    .reduce((sum, task) => sum + task.points, 0);
  const weeklyLoss = losses.spoilage + losses.staffMeal;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-ink/55">Профиль</p>
        <h1 className="font-display text-2xl font-semibold">Мой пульт смены</h1>
      </div>

      <Card>
        <SectionTitle title="Роль" action={<Pill>{role === 'owner' ? 'Owner/Admin' : 'Employee'}</Pill>} />
        <div className="grid grid-cols-2 gap-3">
          <button
            className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
              role === 'employee' ? 'bg-ink text-white' : 'bg-fog text-ink'
            }`}
            onClick={() => setRole('employee')}
          >
            Employee
          </button>
          <button
            className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
              role === 'owner' ? 'bg-ink text-white' : 'bg-fog text-ink'
            }`}
            onClick={() => setRole('owner')}
          >
            Owner/Admin
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-white/80">
          <p className="text-xs text-ink/50">Мой прогресс</p>
          <p className="mt-2 text-2xl font-semibold">{totalPoints} pts</p>
        </Card>
        <Card className="bg-white/80">
          <p className="text-xs text-ink/50">Принятые миссии</p>
          <p className="mt-2 text-2xl font-semibold">{acceptedTasks}</p>
        </Card>
        <Card className="bg-white/80">
          <p className="text-xs text-ink/50">Ожидают приемки</p>
          <p className="mt-2 text-2xl font-semibold">{waitingTasks}</p>
        </Card>
        <Card className="bg-white/80">
          <p className="text-xs text-ink/50">Просрочки</p>
          <p className="mt-2 text-2xl font-semibold">{overdueTasks}</p>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Неделя" />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-fog p-3">
            <p className="text-xs text-ink/50">Потери</p>
            <p className="mt-1 text-xl font-semibold">{weeklyLoss} ₽</p>
            <p className="text-xs text-ink/50">Если без выручки, показываем сумму</p>
          </div>
          <div className="rounded-2xl bg-fog p-3">
            <p className="text-xs text-ink/50">Принятые миссии</p>
            <p className="mt-1 text-xl font-semibold">{acceptedTasks}</p>
            <p className="text-xs text-ink/50">Без токсичных антилидеров</p>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Полезное" />
        <div className="space-y-2">
          <a
            href={appLinks.knowledgeBaseUrl}
            target="_blank"
            rel="noreferrer"
            className="block rounded-2xl bg-fog px-4 py-3 text-sm font-semibold"
          >
            База знаний
          </a>
          <SecondaryButton onClick={resetDemo}>Сбросить демо-данные</SecondaryButton>
        </div>
      </Card>
    </div>
  );
};


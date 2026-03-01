import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { Card, Input, PrimaryButton, SectionTitle } from '../components/ui';

export const LossesScreen = () => {
  const { losses, saveLosses } = useAppStore();
  const [spoilage, setSpoilage] = useState(String(losses.spoilage));
  const [staffMeal, setStaffMeal] = useState(String(losses.staffMeal));
  const [rd, setRd] = useState(String(losses.rd));

  const operatingDamage = useMemo(() => {
    const spoilageValue = Number(spoilage) || 0;
    const staffMealValue = Number(staffMeal) || 0;

    return (spoilageValue + staffMealValue) * 1.2;
  }, [spoilage, staffMeal]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveLosses(Number(spoilage) || 0, Number(staffMeal) || 0, Number(rd) || 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink/55">Потери</p>
          <h1 className="font-display text-2xl font-semibold">Операционный контроль</h1>
        </div>
        <Link to="/" className="rounded-2xl bg-fog px-3 py-2 text-sm font-semibold">
          Назад
        </Link>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        <Card>
          <SectionTitle title="Операционные потери" />
          <div className="space-y-3">
            <Input
              type="number"
              min="0"
              placeholder="Порча"
              value={spoilage}
              onChange={(event) => setSpoilage(event.target.value)}
            />
            <Input
              type="number"
              min="0"
              placeholder="Стафф-питание"
              value={staffMeal}
              onChange={(event) => setStaffMeal(event.target.value)}
            />
            <div className="rounded-2xl bg-fog p-4">
              <p className="text-xs text-ink/50">Операционный ущерб</p>
              <p className="mt-2 text-2xl font-semibold">{operatingDamage.toFixed(0)} ₽</p>
              <p className="text-sm text-ink/60">(Порча + Стафф) × 1.2</p>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="R&D / проработки" />
          <div className="space-y-3">
            <Input
              type="number"
              min="0"
              placeholder="Сумма R&D"
              value={rd}
              onChange={(event) => setRd(event.target.value)}
            />
            <p className="text-sm text-ink/60">
              Эта сумма сохраняется отдельно и не идет в антирейтинг.
            </p>
          </div>
        </Card>

        <PrimaryButton type="submit">Сохранить потери</PrimaryButton>
      </form>
    </div>
  );
};

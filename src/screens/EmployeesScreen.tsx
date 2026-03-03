import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getCurrentEmployee,
  getRoleLabel,
  useAppStore,
} from '../store/useAppStore';
import type { Employee, EmployeeRole } from '../types/domain';
import {
  Card,
  Input,
  Pill,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  Select,
} from '../components/ui';

const sanitizePin = (value: string) => value.replace(/\D/g, '').slice(0, 6);

const roleOptions: { value: Exclude<EmployeeRole, 'owner'>; label: string }[] = [
  { value: 'waiter', label: 'Официант' },
  { value: 'bartender', label: 'Бармен' },
  { value: 'chef', label: 'Повар' },
];

type AddFormState = {
  fullName: string;
  role: Exclude<EmployeeRole, 'owner'>;
  positionTitle: string;
  pin: string;
  confirmPin: string;
  hourlyRate: string;
};

const emptyAddForm: AddFormState = {
  fullName: '',
  role: 'waiter',
  positionTitle: 'Официант',
  pin: '',
  confirmPin: '',
  hourlyRate: '',
};

export const EmployeesScreen = () => {
  const {
    employees,
    createEmployee,
    updateEmployee,
    resetEmployeePin,
    deactivateEmployee,
  } = useAppStore();
  const currentEmployee = useAppStore(getCurrentEmployee);
  const [addForm, setAddForm] = useState<AddFormState>(emptyAddForm);
  const [error, setError] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [resetPinEmployee, setResetPinEmployee] = useState<Employee | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.isActive),
    [employees],
  );
  const archivedEmployees = useMemo(
    () => employees.filter((employee) => !employee.isActive),
    [employees],
  );

  if (currentEmployee?.role !== 'owner') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-ink/55">Сотрудники</p>
            <h1 className="font-display text-2xl font-semibold">Нет доступа</h1>
          </div>
          <Link to="/profile" className="rounded-2xl bg-fog px-3 py-2 text-sm font-semibold">
            Назад
          </Link>
        </div>
        <Card>
          <p className="text-sm text-ink/60">Этот раздел доступен только owner.</p>
        </Card>
      </div>
    );
  }

  const onAddEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (addForm.pin !== addForm.confirmPin) {
      setError('PIN не совпадает');
      return;
    }

    const result = await createEmployee({
      fullName: addForm.fullName,
      role: addForm.role,
      positionTitle: addForm.positionTitle,
      pin: addForm.pin,
      hourlyRate: addForm.role === 'chef' ? Number(addForm.hourlyRate) || null : null,
    });

    if (!result.ok) {
      setError(result.reason ?? 'Не удалось создать сотрудника');
      return;
    }

    setAddForm(emptyAddForm);
  };

  const submitEdit = () => {
    if (!editingEmployee) {
      return;
    }

    const result = updateEmployee(editingEmployee.id, editingEmployee);

    if (!result.ok) {
      setError(result.reason ?? 'Не удалось обновить сотрудника');
      return;
    }

    setEditingEmployee(null);
  };

  const submitResetPin = async () => {
    if (!resetPinEmployee) {
      return;
    }

    if (newPin !== confirmNewPin) {
      setError('PIN не совпадает');
      return;
    }

    const result = await resetEmployeePin(resetPinEmployee.id, newPin);

    if (!result.ok) {
      setError(result.reason ?? 'Не удалось сбросить PIN');
      return;
    }

    setResetPinEmployee(null);
    setNewPin('');
    setConfirmNewPin('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink/55">Owner Dashboard</p>
          <h1 className="font-display text-2xl font-semibold">Сотрудники</h1>
        </div>
        <Link to="/profile" className="rounded-2xl bg-fog px-3 py-2 text-sm font-semibold">
          Назад
        </Link>
      </div>

      <Card>
        <SectionTitle title="Добавить сотрудника" />
        <p className="mb-4 text-sm text-ink/60">PIN — служебный доступ. Не делитесь.</p>
        <form className="space-y-3" onSubmit={onAddEmployee}>
          <Input
            placeholder="Имя и фамилия"
            value={addForm.fullName}
            onChange={(event) =>
              setAddForm((current) => ({ ...current, fullName: event.target.value }))
            }
          />
          <Select
            value={addForm.role}
            onChange={(event) =>
              setAddForm((current) => ({
                ...current,
                role: event.target.value as Exclude<EmployeeRole, 'owner'>,
                positionTitle: getRoleLabel(event.target.value as Exclude<EmployeeRole, 'owner'>),
              }))
            }
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Должность"
            value={addForm.positionTitle}
            onChange={(event) =>
              setAddForm((current) => ({ ...current, positionTitle: event.target.value }))
            }
          />
          {addForm.role === 'chef' ? (
            <Input
              type="number"
              min="0"
              placeholder="Ставка повара"
              value={addForm.hourlyRate}
              onChange={(event) =>
                setAddForm((current) => ({ ...current, hourlyRate: event.target.value }))
              }
            />
          ) : null}
          <Input
            type="password"
            inputMode="numeric"
            placeholder="PIN 4–6 цифр"
            value={addForm.pin}
            onChange={(event) =>
              setAddForm((current) => ({ ...current, pin: sanitizePin(event.target.value) }))
            }
          />
          <Input
            type="password"
            inputMode="numeric"
            placeholder="Повторите PIN"
            value={addForm.confirmPin}
            onChange={(event) =>
              setAddForm((current) => ({
                ...current,
                confirmPin: sanitizePin(event.target.value),
              }))
            }
          />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <PrimaryButton type="submit">Сохранить сотрудника</PrimaryButton>
        </form>
      </Card>

      <Card>
        <SectionTitle title="Активные" action={<Pill>{activeEmployees.length}</Pill>} />
        <div className="space-y-3">
          {activeEmployees.map((employee) => (
            <div key={employee.id} className="rounded-2xl bg-fog p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{employee.fullName}</p>
                  <p className="text-sm text-ink/55">
                    {employee.positionTitle} · {getRoleLabel(employee.role)}
                  </p>
                </div>
                <Pill>{employee.pinHash ? 'PIN задан' : 'Без PIN'}</Pill>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold"
                  onClick={() => {
                    setError(null);
                    setEditingEmployee(employee);
                  }}
                >
                  Изменить
                </button>
                <button
                  className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold"
                  onClick={() => {
                    setError(null);
                    setResetPinEmployee(employee);
                  }}
                >
                  Сбросить PIN
                </button>
                {employee.role !== 'owner' ? (
                  <button
                    className="rounded-2xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                    onClick={() => {
                      const result = deactivateEmployee(employee.id);
                      if (!result.ok) {
                        setError(result.reason ?? 'Не удалось деактивировать');
                      }
                    }}
                  >
                    Деактивировать
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Архив" action={<Pill>{archivedEmployees.length}</Pill>} />
        <div className="space-y-3">
          {archivedEmployees.length === 0 ? (
            <p className="text-sm text-ink/55">Архив пуст.</p>
          ) : (
            archivedEmployees.map((employee) => (
              <div key={employee.id} className="rounded-2xl bg-fog p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{employee.fullName}</p>
                    <p className="text-sm text-ink/55">
                      {employee.positionTitle} · {getRoleLabel(employee.role)}
                    </p>
                  </div>
                  <Pill tone="danger">Архив</Pill>
                </div>
                <div className="mt-3">
                  <button
                    className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold"
                    onClick={() => {
                      const result = updateEmployee(employee.id, { isActive: true });
                      if (!result.ok) {
                        setError(result.reason ?? 'Не удалось вернуть сотрудника');
                      }
                    }}
                  >
                    Вернуть
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {editingEmployee ? (
        <div className="fixed inset-0 z-20 flex items-end bg-black/30">
          <div className="w-full rounded-t-[2rem] bg-white p-5">
            <SectionTitle title="Изменить сотрудника" />
            <div className="space-y-3">
              <Input
                value={editingEmployee.fullName}
                onChange={(event) =>
                  setEditingEmployee((current) =>
                    current
                      ? {
                          ...current,
                          fullName: event.target.value,
                        }
                      : current,
                  )
                }
              />
              <Select
                value={editingEmployee.role}
                onChange={(event) =>
                  setEditingEmployee((current) =>
                    current
                      ? {
                          ...current,
                          role: event.target.value as EmployeeRole,
                        }
                      : current,
                  )
                }
              >
                <option value="waiter">Официант</option>
                <option value="bartender">Бармен</option>
                <option value="chef">Повар</option>
                <option value="owner">Owner</option>
              </Select>
              <Input
                value={editingEmployee.positionTitle}
                onChange={(event) =>
                  setEditingEmployee((current) =>
                    current
                      ? {
                          ...current,
                          positionTitle: event.target.value,
                        }
                      : current,
                  )
                }
              />
              {editingEmployee.role === 'chef' || editingEmployee.role === 'owner' ? (
                <Input
                  type="number"
                  min="0"
                  placeholder="Ставка"
                  value={editingEmployee.hourlyRate ?? ''}
                  onChange={(event) =>
                    setEditingEmployee((current) =>
                      current
                        ? {
                            ...current,
                            hourlyRate: Number(event.target.value) || null,
                          }
                        : current,
                    )
                  }
                />
              ) : null}
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={editingEmployee.isActive}
                  onChange={(event) =>
                    setEditingEmployee((current) =>
                      current
                        ? {
                            ...current,
                            isActive: event.target.checked,
                          }
                        : current,
                    )
                  }
                />
                Активен
              </label>
            </div>
            <div className="mt-4 flex gap-3">
              <PrimaryButton onClick={submitEdit}>Сохранить</PrimaryButton>
              <button
                className="rounded-2xl border border-ink/10 px-4 py-3 text-sm font-semibold"
                onClick={() => setEditingEmployee(null)}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {resetPinEmployee ? (
        <div className="fixed inset-0 z-20 flex items-end bg-black/30">
          <div className="w-full rounded-t-[2rem] bg-white p-5">
            <SectionTitle title={`Новый PIN: ${resetPinEmployee.fullName}`} />
            <div className="space-y-3">
              <Input
                type="password"
                inputMode="numeric"
                placeholder="Новый PIN"
                value={newPin}
                onChange={(event) => setNewPin(sanitizePin(event.target.value))}
              />
              <Input
                type="password"
                inputMode="numeric"
                placeholder="Повторите PIN"
                value={confirmNewPin}
                onChange={(event) => setConfirmNewPin(sanitizePin(event.target.value))}
              />
            </div>
            <div className="mt-4 flex gap-3">
              <PrimaryButton onClick={submitResetPin}>Сохранить PIN</PrimaryButton>
              <button
                className="rounded-2xl border border-ink/10 px-4 py-3 text-sm font-semibold"
                onClick={() => {
                  setResetPinEmployee(null);
                  setNewPin('');
                  setConfirmNewPin('');
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

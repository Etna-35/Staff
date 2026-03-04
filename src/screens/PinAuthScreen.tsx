import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Card, Input, PrimaryButton, Screen, SectionTitle, Select } from '../components/ui';

const sanitizePin = (value: string) => value.replace(/\D/g, '').slice(0, 6);

export const PinAuthScreen = () => {
  const {
    session,
    authError,
    loginEmployees,
    loginEmployeesLoading,
    clearAuthError,
    loadBootstrapStatus,
    refreshLoginEmployees,
    bootstrapOwner,
    loginWithPin,
  } = useAppStore();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [founderName, setFounderName] = useState('Юра');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session.bootstrapped && loginEmployees.length === 0 && !loginEmployeesLoading) {
      void refreshLoginEmployees();
    }
  }, [loginEmployees.length, loginEmployeesLoading, refreshLoginEmployees, session.bootstrapped]);

  useEffect(() => {
    if (!selectedEmployeeId && loginEmployees.length > 0) {
      setSelectedEmployeeId(loginEmployees[0].id);
    }
  }, [loginEmployees, selectedEmployeeId]);

  const isBootstrapMode = session.bootstrapped === false;

  const submitOwnerPin = async () => {
    setError(null);
    clearAuthError();

    if (pin !== confirmPin) {
      setError('PIN не совпадает');
      return;
    }

    setSubmitting(true);
    const result = await bootstrapOwner(founderName, pin);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.reason ?? 'Не удалось сохранить PIN');
    }
  };

  const submitLogin = async () => {
    setError(null);
    clearAuthError();

    if (!selectedEmployeeId) {
      setError('Выберите сотрудника');
      return;
    }

    setSubmitting(true);
    const result = await loginWithPin(selectedEmployeeId, pin);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.reason ?? 'Не удалось войти');
    }
  };

  return (
    <Screen>
      <div className="flex min-h-[calc(100vh-4rem)] flex-col justify-center gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">
            Доступ только для сотрудников ресторана
          </h1>
        </div>

        <Card className="space-y-4">
          {isBootstrapMode ? (
            <>
              <SectionTitle title="Создать PIN основателя" />
              <p className="text-sm text-ink/60">
                Общий backend еще не инициализирован. Создайте первый owner-доступ один раз для
                всех устройств.
              </p>
              <div className="space-y-3">
                <Input
                  placeholder="Имя основателя"
                  value={founderName}
                  onChange={(event) => setFounderName(event.target.value)}
                />
                <Input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  placeholder="PIN 4–6 цифр"
                  value={pin}
                  onChange={(event) => setPin(sanitizePin(event.target.value))}
                />
                <Input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  placeholder="Повторите PIN"
                  value={confirmPin}
                  onChange={(event) => setConfirmPin(sanitizePin(event.target.value))}
                />
                <button
                  className="text-sm font-semibold text-clay"
                  onClick={() => setShowPin((current) => !current)}
                >
                  {showPin ? '🙈 Скрыть' : '👁 Показать'}
                </button>
              </div>
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
              {authError ? <p className="text-sm text-red-700">{authError}</p> : null}
              <PrimaryButton disabled={submitting} onClick={submitOwnerPin}>
                Сохранить Owner PIN
              </PrimaryButton>
              <button
                className="text-sm font-semibold text-clay"
                onClick={() => void loadBootstrapStatus()}
              >
                Обновить статус
              </button>
            </>
          ) : (
            <>
              <SectionTitle title="Введите PIN" />
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-sm font-semibold text-ink">Кто вы?</p>
                  <Select
                    value={selectedEmployeeId}
                    disabled={loginEmployeesLoading || loginEmployees.length === 0}
                    onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  >
                    {loginEmployees.length === 0 ? (
                      <option value="">Нет активных сотрудников</option>
                    ) : null}
                    {loginEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fullName}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-ink">PIN</p>
                  <Input
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    placeholder="4–6 цифр"
                    value={pin}
                    onChange={(event) => setPin(sanitizePin(event.target.value))}
                    disabled={loginEmployeesLoading || loginEmployees.length === 0}
                  />
                </div>
                <button
                  className="text-sm font-semibold text-clay"
                  onClick={() => setShowPin((current) => !current)}
                >
                  {showPin ? '🙈 Скрыть' : '👁 Показать'}
                </button>
              </div>
              {loginEmployeesLoading ? (
                <p className="text-sm text-ink/55">Загружаем список сотрудников…</p>
              ) : null}
              {!loginEmployeesLoading && loginEmployees.length === 0 ? (
                <p className="text-sm text-amber-800">
                  {authError
                    ? 'Не удалось получить список сотрудников. Проверьте подключение к Worker API.'
                    : 'Активных сотрудников пока нет. Войдите owner-пользователем на другом устройстве и добавьте команду.'}
                </p>
              ) : null}
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
              {authError ? <p className="text-sm text-red-700">{authError}</p> : null}
              <PrimaryButton
                disabled={submitting || loginEmployeesLoading || loginEmployees.length === 0}
                onClick={submitLogin}
              >
                Войти
              </PrimaryButton>
              <button
                className="text-sm font-semibold text-clay"
                onClick={() => void refreshLoginEmployees()}
              >
                Обновить список
              </button>
            </>
          )}
        </Card>
      </div>
    </Screen>
  );
};

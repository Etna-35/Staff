import { useEffect, useMemo, useState } from 'react';
import {
  getActiveEmployees,
  getOwnerWithoutPin,
  useAppStore,
} from '../store/useAppStore';
import { Card, Input, PrimaryButton, Screen, SectionTitle, Select } from '../components/ui';

const formatRemaining = (lockUntil: string | null) => {
  if (!lockUntil) {
    return null;
  }

  const remainingMs = new Date(lockUntil).getTime() - Date.now();

  if (remainingMs <= 0) {
    return null;
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const sanitizePin = (value: string) => value.replace(/\D/g, '').slice(0, 6);

export const PinAuthScreen = () => {
  const {
    session,
    employees,
    ensureBootstrapOwner,
    ensureSessionValidity,
    unlockIfExpired,
    loginWithPin,
    setupOwnerPin,
  } = useAppStore();
  const ownerWithoutPin = useAppStore(getOwnerWithoutPin);
  const activeEmployees = useAppStore(getActiveEmployees);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    ensureBootstrapOwner();
    ensureSessionValidity();
    unlockIfExpired();
  }, [ensureBootstrapOwner, ensureSessionValidity, unlockIfExpired]);

  useEffect(() => {
    if (!selectedEmployeeId && activeEmployees.length > 0) {
      setSelectedEmployeeId(activeEmployees[0].id);
    }
  }, [activeEmployees, selectedEmployeeId]);

  useEffect(() => {
    setCountdown(formatRemaining(session.lockUntil));

    if (!session.lockUntil) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      unlockIfExpired();
      setCountdown(formatRemaining(useAppStore.getState().session.lockUntil));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [session.lockUntil, unlockIfExpired]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  const isLocked = Boolean(countdown);
  const isSetupMode = Boolean(ownerWithoutPin);

  const submitOwnerPin = async () => {
    setError(null);

    if (pin !== confirmPin) {
      setError('PIN не совпадает');
      return;
    }

    const result = await setupOwnerPin(pin);

    if (!result.ok) {
      setError(result.reason ?? 'Не удалось сохранить PIN');
    }
  };

  const submitLogin = async () => {
    setError(null);

    if (!selectedEmployeeId) {
      setError('Выберите сотрудника');
      return;
    }

    const result = await loginWithPin(selectedEmployeeId, pin, true);

    if (!result.ok) {
      setError(result.reason ?? 'Не удалось войти');
    }
  };

  return (
    <Screen>
      <div className="flex min-h-[calc(100vh-4rem)] flex-col justify-center gap-4">
        <div>
          <p className="text-sm text-ink/55">Restaurant OS</p>
          <h1 className="font-display text-3xl font-semibold text-ink">
            Доступ только для сотрудников ресторана
          </h1>
        </div>

        <Card className="space-y-4">
          {isSetupMode ? (
            <>
              <SectionTitle title="Создайте Owner PIN" />
              <p className="text-sm text-ink/60">
                Первый запуск. Для аккаунта {ownerWithoutPin?.fullName} нужно задать служебный PIN.
              </p>
              <div className="space-y-3">
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
              <PrimaryButton onClick={submitOwnerPin}>Сохранить Owner PIN</PrimaryButton>
            </>
          ) : (
            <>
              <SectionTitle title="Введите PIN" />
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-sm font-semibold text-ink">Кто вы?</p>
                  <Select
                    value={selectedEmployeeId}
                    onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  >
                    {activeEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fullName} · {employee.positionTitle}
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
                    disabled={isLocked}
                  />
                </div>
                <button
                  className="text-sm font-semibold text-clay"
                  onClick={() => setShowPin((current) => !current)}
                >
                  {showPin ? '🙈 Скрыть' : '👁 Показать'}
                </button>
              </div>
              {selectedEmployee && !selectedEmployee.pinHash ? (
                <p className="text-sm text-amber-800">
                  Для этого сотрудника PIN еще не назначен. Обратитесь к Owner.
                </p>
              ) : null}
              {isLocked ? (
                <p className="text-sm text-red-700">Попробуйте позже: {countdown}</p>
              ) : null}
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
              <PrimaryButton disabled={isLocked} onClick={submitLogin}>
                Войти
              </PrimaryButton>
            </>
          )}
        </Card>
      </div>
    </Screen>
  );
};


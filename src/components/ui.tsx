import { clsx } from 'clsx';
import { Link, NavLink } from 'react-router-dom';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';

export const Screen = ({ children }: PropsWithChildren) => (
  <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-28 pt-4 safe-pt">
    {children}
  </div>
);

export const Card = ({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) => (
  <section className={clsx('rounded-panel bg-white/90 p-4 shadow-card', className)}>
    {children}
  </section>
);

export const Pill = ({
  children,
  tone = 'default',
}: PropsWithChildren<{ tone?: 'default' | 'warning' | 'success' | 'danger' }>) => {
  const toneClass = {
    default: 'bg-fog text-ink',
    warning: 'bg-citrus/20 text-amber-900',
    success: 'bg-pine/15 text-pine',
    danger: 'bg-red-100 text-red-700',
  }[tone];

  return (
    <span className={clsx('rounded-full px-3 py-1 text-xs font-semibold', toneClass)}>
      {children}
    </span>
  );
};

export const SectionTitle = ({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) => (
  <div className="mb-3 flex items-center justify-between">
    <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
    {action}
  </div>
);

export const ProgressBar = ({ value }: { value: number }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-sm text-ink/70">
      <span>Прогресс смены</span>
      <span className="font-semibold text-ink">{value}%</span>
    </div>
    <div className="h-3 rounded-full bg-fog">
      <div
        className="h-3 rounded-full bg-gradient-to-r from-clay to-citrus transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

export const PrimaryButton = ({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={clsx(
      'w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-ink/35',
      className,
    )}
    {...props}
  >
    {children}
  </button>
);

export const SecondaryButton = ({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={clsx(
      'w-full rounded-2xl border border-ink/10 bg-fog px-4 py-3 text-sm font-semibold text-ink',
      className,
    )}
    {...props}
  >
    {children}
  </button>
);

export const Input = ({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={clsx(
      'w-full rounded-2xl border border-ink/10 bg-[#fcfaf5] px-4 py-3 text-sm outline-none ring-0 placeholder:text-ink/35',
      className,
    )}
    {...props}
  />
);

export const Textarea = ({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={clsx(
      'min-h-24 w-full rounded-2xl border border-ink/10 bg-[#fcfaf5] px-4 py-3 text-sm outline-none placeholder:text-ink/35',
      className,
    )}
    {...props}
  />
);

export const ShellHeader = ({
  name,
  subtitle,
}: {
  name: string;
  subtitle: string;
}) => (
  <div className="mb-4 rounded-[2rem] bg-ink px-5 py-5 text-white shadow-card">
    <p className="text-sm text-white/65">{subtitle}</p>
    <div className="mt-2 flex items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold">{name}</h1>
        <p className="text-sm text-white/65">
          Telegram имя показано из `initDataUnsafe.user`
        </p>
      </div>
      <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em]">
        shift
      </div>
    </div>
  </div>
);

const navItems = [
  { to: '/', label: 'Смена' },
  { to: '/missions', label: 'Миссии' },
  { to: '/requests', label: 'Заявки' },
  { to: '/profile', label: 'Я' },
];

export const BottomBar = () => (
  <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md px-4 pb-4 safe-pb">
    <nav className="grid grid-cols-4 rounded-[1.75rem] border border-white/60 bg-white/90 p-2 shadow-card backdrop-blur">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            clsx(
              'rounded-2xl px-2 py-3 text-center text-xs font-semibold',
              isActive ? 'bg-ink text-white' : 'text-ink/55',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  </div>
);

export const InlineLink = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link className="text-sm font-semibold text-clay" to={to}>
    {children}
  </Link>
);

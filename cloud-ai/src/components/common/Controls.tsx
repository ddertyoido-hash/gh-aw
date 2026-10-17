/**
 * Shared controls: buttons, fields, switches, sliders, segmented pickers and
 * chips. All surfaces reuse the glass language of the shell.
 */
import { motion, type HTMLMotionProps } from 'framer-motion'
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { cn } from '../../lib/utils'

type ButtonVariant = 'primary' | 'glass' | 'ghost' | 'danger' | 'soft'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  loading?: boolean
  block?: boolean
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'aurora-surface text-white shadow-lift hover:brightness-110 border border-white/30 animate-shimmer',
  glass: 'glass text-ink hover:bg-white/70 dark:hover:bg-white/10',
  soft: 'bg-white/55 text-ink-soft hover:bg-white/75 border border-white/50 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15',
  ghost: 'text-ink-soft hover:bg-white/55 dark:hover:bg-white/10',
  danger: 'bg-rose-500/90 text-white hover:bg-rose-500 border border-rose-300/40',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-xl',
  md: 'h-10 px-4 text-sm gap-2 rounded-2xl',
  lg: 'h-12 px-5 text-[15px] gap-2.5 rounded-2xl',
}

export function Button({
  variant = 'glass',
  size = 'md',
  icon,
  loading = false,
  block = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex select-none items-center justify-center font-medium transition-[transform,box-shadow,background-color,filter] duration-200 focus-ring',
        'active:scale-[0.975] disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
    >
      {loading ? <Spinner size={16} /> : icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  size?: 'sm' | 'md' | 'lg'
  active?: boolean
  variant?: 'glass' | 'ghost'
}

export function IconButton({ label, size = 'md', active, variant = 'ghost', className, children, ...rest }: IconButtonProps) {
  const dimension = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-xl transition-all duration-200 focus-ring active:scale-95',
        dimension,
        variant === 'glass' ? 'glass text-ink-soft hover:text-ink' : 'text-ink-muted hover:bg-white/55 hover:text-ink dark:hover:bg-white/10',
        active && 'bg-white/75 text-ink shadow-glow dark:bg-white/15',
        'disabled:cursor-not-allowed disabled:opacity-55',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-block animate-spin rounded-full border-2 border-current border-t-transparent opacity-80', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  )
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="block text-[12px] font-medium uppercase tracking-wide text-ink-muted">{label}</span>
      {children}
      {hint && <span className="block text-[12px] leading-snug text-ink-muted">{hint}</span>}
    </label>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cn(
        'h-10 w-full rounded-xl border border-white/55 bg-white/70 px-3 text-sm text-ink placeholder:text-ink-muted',
        'outline-none transition focus:border-white focus:bg-white/85 focus:shadow-glow',
        'dark:border-white/15 dark:bg-slate-900/50 dark:text-slate-100',
        className,
      )}
    />
  )
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={cn(
        'w-full rounded-2xl border border-white/55 bg-white/70 p-3 text-sm leading-relaxed text-ink placeholder:text-ink-muted',
        'outline-none transition focus:border-white focus:bg-white/85 focus:shadow-glow',
        'dark:border-white/15 dark:bg-slate-900/50 dark:text-slate-100',
        className,
      )}
    />
  )
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={cn(
        'h-10 w-full appearance-none rounded-xl border border-white/55 bg-white/70 px-3 pr-8 text-sm text-ink',
        'outline-none transition focus:border-white focus:shadow-glow dark:border-white/15 dark:bg-slate-900/60 dark:text-slate-100',
        className,
      )}
    >
      {children}
    </select>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{label}</div>
        {description && <div className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors duration-300 focus-ring',
          checked ? 'aurora-surface border-white/40' : 'border-white/50 bg-slate-400/40 dark:bg-slate-700/60',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 520, damping: 32 }}
          className={cn('absolute top-0.5 rounded-full bg-white shadow', checked ? 'left-[22px]' : 'left-0.5')}
          style={{ height: 18, width: 18 }}
        />
      </button>
    </div>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  valueLabel,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  label: string
  valueLabel?: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="tabular-nums text-ink-muted">{valueLabel ?? value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-400/35 accent-[var(--aurora-blue)] dark:bg-slate-600/60"
        style={{ accentColor: 'var(--aurora-blue)' }}
      />
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  className,
}: {
  value: T
  options: Array<{ value: T; label: string; icon?: ReactNode }>
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-2xl border border-white/50 bg-white/45 p-1 dark:border-white/15 dark:bg-slate-900/40',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              'relative inline-flex items-center gap-1.5 rounded-xl font-medium transition-colors duration-200 focus-ring',
              size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-8 px-3 text-[13px]',
              active ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${options.map((option) => option.value).join('-')}`}
                className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-white/15"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {option.icon}
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function Chip({
  children,
  onRemove,
  icon,
  className,
}: {
  children: ReactNode
  onRemove?: () => void
  icon?: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/55 bg-white/65 px-2.5 py-1 text-[12.5px] text-ink-soft',
        'dark:border-white/15 dark:bg-white/10 dark:text-slate-200',
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="rounded-full px-1 text-ink-muted transition hover:bg-white/70 hover:text-ink dark:hover:bg-white/15"
        >
          ×
        </button>
      )}
    </span>
  )
}

export function Card({ className, children, ...rest }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      {...rest}
      className={cn('glass rounded-3xl p-5', className)}
    >
      {children}
    </motion.div>
  )
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

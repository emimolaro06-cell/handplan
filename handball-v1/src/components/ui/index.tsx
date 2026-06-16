import { clsx } from '@/lib/utils'
import { forwardRef, useEffect, useRef } from 'react'

import { X, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

// ─── Button ──────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'gold'
type BtnSize = 'xs' | 'sm' | 'md' | 'lg'

const BV: Record<BtnVariant, string> = {
  primary:   'bg-dj-600 hover:bg-dj-700 text-white border-transparent shadow-sm',
  secondary: 'bg-white hover:bg-gray-50 text-gray-800 border-gray-200 shadow-sm',
  ghost:     'bg-transparent hover:bg-gray-100 text-gray-700 border-transparent',
  danger:    'bg-red-600 hover:bg-red-700 text-white border-transparent shadow-sm',
  success:   'bg-dj-600 hover:bg-dj-700 text-white border-transparent shadow-sm',
  gold:      'bg-gold-500 hover:bg-gold-600 text-gray-900 border-transparent shadow-sm',
}
const BS: Record<BtnSize, string> = {
  xs: 'text-xs px-2.5 py-1 gap-1',
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
  lg: 'text-sm px-5 py-2.5 gap-2',
}

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant; size?: BtnSize; loading?: boolean; icon?: React.ReactNode
}
export const Button = forwardRef<HTMLButtonElement, BtnProps>(
  ({ variant='primary', size='md', loading, icon, className, children, disabled, ...p }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-xl border',
        'transition-all duration-150 active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dj-400 focus-visible:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        BV[variant], BS[size], className,
      )}
      {...p}
    >
      {loading
        ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
        : icon ? <span className="flex-shrink-0">{icon}</span> : null
      }
      {children}
    </button>
  )
)
Button.displayName = 'Button'

// ─── Input ───────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string; error?: string; hint?: string
}
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...p }, ref) => {
    const fid = id ?? label?.toLowerCase().replace(/\s+/g,'-')
    return (
      <div className="flex flex-col gap-1">
        {label && <label htmlFor={fid} className="text-sm font-medium text-gray-700">{label}</label>}
        <input
          ref={ref} id={fid}
          className={clsx(
            'w-full rounded-xl border px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-dj-400 focus:border-dj-400 transition-colors',
            error ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300',
            className,
          )}
          {...p}
        />
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

// ─── Textarea ────────────────────────────────────────────────────────────────
interface TAProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string; error?: string; hint?: string
}
export const Textarea = forwardRef<HTMLTextAreaElement, TAProps>(
  ({ label, error, hint, className, id, ...p }, ref) => {
    const fid = id ?? label?.toLowerCase().replace(/\s+/g,'-')
    return (
      <div className="flex flex-col gap-1">
        {label && <label htmlFor={fid} className="text-sm font-medium text-gray-700">{label}</label>}
        <textarea
          ref={ref} id={fid}
          className={clsx(
            'w-full rounded-xl border px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 resize-none',
            'focus:outline-none focus:ring-2 focus:ring-dj-400 focus:border-dj-400 transition-colors',
            error ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300',
            className,
          )}
          {...p}
        />
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

// ─── Select ──────────────────────────────────────────────────────────────────
interface SelProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string; error?: string; hint?: string
  options: { value: string; label: string }[]
  placeholder?: string
}
export const Select = forwardRef<HTMLSelectElement, SelProps>(
  ({ label, error, hint, options, placeholder, className, id, ...p }, ref) => {
    const fid = id ?? label?.toLowerCase().replace(/\s+/g,'-')
    return (
      <div className="flex flex-col gap-1">
        {label && <label htmlFor={fid} className="text-sm font-medium text-gray-700">{label}</label>}
        <select
          ref={ref} id={fid}
          className={clsx(
            'w-full rounded-xl border px-3 py-2 text-sm text-gray-900 bg-white cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-dj-400 focus:border-dj-400 transition-colors',
            error ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300',
            className,
          )}
          {...p}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'

// ─── Card ────────────────────────────────────────────────────────────────────
export function Card({ className, children, padded=true, ...p }:
  React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }
) {
  return (
    <div className={clsx('bg-white rounded-2xl border border-gray-100 shadow-sm', padded && 'p-5', className)} {...p}>
      {children}
    </div>
  )
}

// ─── Badge ───────────────────────────────────────────────────────────────────
type BadgeColor = 'green' | 'blue' | 'amber' | 'red' | 'purple' | 'gray' | 'sky'
const BC: Record<BadgeColor, string> = {
  green:  'bg-dj-100 text-dj-800',
  blue:   'bg-blue-100 text-blue-800',
  amber:  'bg-amber-100 text-amber-800',
  red:    'bg-red-100 text-red-800',
  purple: 'bg-purple-100 text-purple-800',
  gray:   'bg-gray-100 text-gray-700',
  sky:    'bg-sky-100 text-sky-800',
}
export function Badge({ color='gray', children, className }:
  { color?: BadgeColor; children: React.ReactNode; className?: string }
) {
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', BC[color], className)}>
      {children}
    </span>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size=24 }: { size?: number }) {
  return (
    <svg className="animate-spin text-dj-600" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  )
}

// ─── Empty ───────────────────────────────────────────────────────────────────
export function Empty({ icon, title, description, action }: {
  icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
      {icon && <div className="text-gray-300 mb-2">{icon}</div>}
      <p className="font-semibold text-gray-700">{title}</p>
      {description && <p className="text-sm text-gray-500 max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ─── Toast ───────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning'
const TT: Record<ToastType, { bg: string; icon: React.ReactNode }> = {
  success: { bg: 'bg-dj-700',  icon: <CheckCircle size={18}/> },
  error:   { bg: 'bg-red-600', icon: <XCircle size={18}/> },
  warning: { bg: 'bg-amber-500', icon: <AlertCircle size={18}/> },
}
export function Toast({ message, type='success', onClose, duration=3500 }: {
  message: string; type?: ToastType; onClose: () => void; duration?: number
}) {
  useEffect(() => { const t = setTimeout(onClose, duration); return () => clearTimeout(t) }, [onClose, duration])
  const { bg, icon } = TT[type]
  return (
    <div className={clsx(
      'fixed bottom-6 right-6 z-50 flex items-center gap-3 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-xl animate-slide-up',
      bg,
    )}>
      {icon}<span>{message}</span>
      <button onClick={onClose} className="ml-1 hover:opacity-70"><X size={15}/></button>
    </div>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, maxWidth='max-w-lg' }: {
  open: boolean; onClose: () => void; title?: string
  children: React.ReactNode; maxWidth?: string
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null
  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className={clsx('bg-white rounded-2xl shadow-2xl w-full animate-slide-up', maxWidth)}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18}/></button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

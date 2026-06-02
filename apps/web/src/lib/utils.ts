import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names and dedupe conflicting Tailwind classes. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export const formatCurrency = (value: number) => currency.format(value);

export const formatNumber = (value: number) => new Intl.NumberFormat('id-ID').format(value);

export const formatDate = (value: string | Date) =>
  new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value));

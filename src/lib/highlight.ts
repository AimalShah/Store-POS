export const highlight = {
  blue: 'rounded-md bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  green:
    'rounded-md bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  amber:
    'rounded-md bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  red: 'rounded-md bg-red-50 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-950 dark:text-red-300',
  slate:
    'rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300',
} as const;

export type HighlightKey = keyof typeof highlight;

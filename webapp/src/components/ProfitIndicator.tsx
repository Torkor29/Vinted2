import { formatPriceCompact, formatPercent } from '../utils/formatters.js';

interface Props {
  profit: string | number | null;
  profitPct: string | number | null;
  size?: 'sm' | 'md';
}

export default function ProfitIndicator({ profit, profitPct, size = 'md' }: Props) {
  if (profit === null || profit === undefined) return null;

  const profitNum = typeof profit === 'string' ? parseFloat(profit) : profit;
  const isPositive = profitNum >= 0;

  const sizeClasses = size === 'md'
    ? 'text-base font-bold'
    : 'text-sm font-medium';

  return (
    <div className={`flex items-center gap-1.5 ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
      <span className={sizeClasses}>
        {isPositive ? '+' : ''}{formatPriceCompact(profitNum)}
      </span>
      {profitPct !== null && profitPct !== undefined && (
        <span className={`${size === 'md' ? 'text-sm' : 'text-xs'} opacity-75`}>
          ({formatPercent(profitPct)})
        </span>
      )}
    </div>
  );
}

import { formatPriceCompact } from '../utils/formatters.js';

interface Props {
  price: string | number;
  originalPrice?: string | number | null;
  currency?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function PriceTag({ price, originalPrice, size = 'md' }: Props) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`font-bold text-tg ${sizeClasses[size]}`}>
        {formatPriceCompact(price)}
      </span>
      {originalPrice && (
        <span className={`text-tg-hint line-through ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>
          {formatPriceCompact(originalPrice)}
        </span>
      )}
    </div>
  );
}

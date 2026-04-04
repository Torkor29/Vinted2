interface Props {
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
}

export default function PriceRange({ min, max, onChange }: Props) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <label className="text-xs text-tg-hint block mb-1">Prix min</label>
        <div className="relative">
          <input
            type="number"
            min="0"
            step="0.01"
            value={min ?? ''}
            onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null, max)}
            placeholder="0"
            className="w-full bg-tg-secondary rounded-lg px-3 py-2.5 text-sm text-tg outline-none focus:ring-2 focus:ring-tg-button/30"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tg-hint text-sm">EUR</span>
        </div>
      </div>

      <span className="text-tg-hint mt-5">-</span>

      <div className="flex-1">
        <label className="text-xs text-tg-hint block mb-1">Prix max</label>
        <div className="relative">
          <input
            type="number"
            min="0"
            step="0.01"
            value={max ?? ''}
            onChange={(e) => onChange(min, e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="500"
            className="w-full bg-tg-secondary rounded-lg px-3 py-2.5 text-sm text-tg outline-none focus:ring-2 focus:ring-tg-button/30"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tg-hint text-sm">EUR</span>
        </div>
      </div>
    </div>
  );
}

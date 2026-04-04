import { hapticFeedback } from '../utils/telegram.js';

interface Props {
  selected: number[];
  onChange: (ids: number[]) => void;
}

const CLOTHING_SIZES = [
  { id: 206, name: 'XXS' },
  { id: 207, name: 'XS' },
  { id: 208, name: 'S' },
  { id: 209, name: 'M' },
  { id: 210, name: 'L' },
  { id: 211, name: 'XL' },
  { id: 212, name: 'XXL' },
  { id: 213, name: 'XXXL' },
];

const SHOE_SIZES = Array.from({ length: 16 }, (_, i) => ({
  id: 55 + i,
  name: String(35 + i),
}));

export default function SizePicker({ selected, onChange }: Props) {
  const toggle = (id: number) => {
    hapticFeedback('light');
    if (selected.includes(id)) {
      onChange(selected.filter(i => i !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-tg-hint mb-2">Vetements</div>
        <div className="flex flex-wrap gap-2">
          {CLOTHING_SIZES.map(size => {
            const isSelected = selected.includes(size.id);
            return (
              <button
                key={size.id}
                type="button"
                onClick={() => toggle(size.id)}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${isSelected
                    ? 'bg-tg-button text-tg-button'
                    : 'bg-tg-secondary text-tg'}
                `}
              >
                {size.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-xs text-tg-hint mb-2">Chaussures</div>
        <div className="flex flex-wrap gap-2">
          {SHOE_SIZES.map(size => {
            const isSelected = selected.includes(size.id);
            return (
              <button
                key={size.id}
                type="button"
                onClick={() => toggle(size.id)}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${isSelected
                    ? 'bg-tg-button text-tg-button'
                    : 'bg-tg-secondary text-tg'}
                `}
              >
                {size.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

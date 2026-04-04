import { VINTED_COLORS } from '../utils/constants.js';
import { hapticFeedback } from '../utils/telegram.js';

interface Props {
  selected: number[];
  onChange: (ids: number[]) => void;
}

export default function ColorPicker({ selected, onChange }: Props) {
  const toggle = (id: number) => {
    hapticFeedback('light');
    if (selected.includes(id)) {
      onChange(selected.filter(i => i !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="grid grid-cols-7 gap-2">
      {VINTED_COLORS.map(color => {
        const isSelected = selected.includes(color.id);
        return (
          <button
            key={color.id}
            type="button"
            onClick={() => toggle(color.id)}
            className={`
              w-9 h-9 rounded-full border-2 transition-all relative
              ${isSelected ? 'border-tg-button scale-110' : 'border-transparent'}
            `}
            style={{ backgroundColor: color.hex }}
            title={color.name}
          >
            {isSelected && (
              <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold drop-shadow-md">
                *
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

import { VINTED_CONDITIONS } from '../utils/constants.js';
import { hapticFeedback } from '../utils/telegram.js';

interface Props {
  selected: number[];
  onChange: (ids: number[]) => void;
}

export default function ConditionPicker({ selected, onChange }: Props) {
  const toggle = (id: number) => {
    hapticFeedback('light');
    if (selected.includes(id)) {
      onChange(selected.filter(i => i !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-2">
      {VINTED_CONDITIONS.map(condition => {
        const isSelected = selected.includes(condition.id);
        return (
          <button
            key={condition.id}
            type="button"
            onClick={() => toggle(condition.id)}
            className={`
              w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all
              ${isSelected ? 'bg-tg-button/10 border border-tg-button' : 'bg-tg-secondary border border-transparent'}
            `}
          >
            <span className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
              ${isSelected ? 'border-tg-button bg-tg-button' : 'border-gray-300'}
            `}>
              {isSelected && <span className="text-white text-xs">*</span>}
            </span>
            <div>
              <div className="text-sm font-medium text-tg">{condition.name}</div>
              <div className="text-xs text-tg-hint">{condition.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

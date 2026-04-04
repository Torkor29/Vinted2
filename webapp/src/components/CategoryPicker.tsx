import { useState } from 'react';
import { DEFAULT_CATEGORIES } from '../utils/constants.js';
import { hapticFeedback } from '../utils/telegram.js';

interface Category {
  id: number;
  name: string;
  children?: Category[];
}

interface Props {
  selected: number[];
  onChange: (ids: number[]) => void;
}

export default function CategoryPicker({ selected, onChange }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [isOpen, setIsOpen] = useState(false);

  const toggleExpand = (id: number) => {
    const next = new Set(expanded);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpanded(next);
  };

  const toggleSelect = (id: number) => {
    hapticFeedback('light');
    if (selected.includes(id)) {
      onChange(selected.filter(i => i !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const renderCategory = (cat: Category, depth: number = 0) => {
    const hasChildren = cat.children && cat.children.length > 0;
    const isExpanded = expanded.has(cat.id);
    const isSelected = selected.includes(cat.id);

    return (
      <div key={cat.id}>
        <div
          className="flex items-center gap-2 py-2 cursor-pointer hover:bg-tg-secondary rounded-lg px-2"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {hasChildren && (
            <button
              type="button"
              onClick={() => toggleExpand(cat.id)}
              className="w-5 h-5 flex items-center justify-center text-tg-hint text-xs"
            >
              {isExpanded ? 'v' : '>'}
            </button>
          )}
          {!hasChildren && <span className="w-5" />}

          <button
            type="button"
            onClick={() => toggleSelect(cat.id)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
              ${isSelected ? 'border-tg-button bg-tg-button' : 'border-gray-300'}
            `}
          >
            {isSelected && <span className="text-white text-[10px]">*</span>}
          </button>

          <span
            className="text-sm text-tg flex-1"
            onClick={() => hasChildren ? toggleExpand(cat.id) : toggleSelect(cat.id)}
          >
            {cat.name}
          </span>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {cat.children!.map(child => renderCategory(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const selectedNames = getSelectedNames(DEFAULT_CATEGORIES, selected);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-tg-secondary rounded-lg px-3 py-2.5 text-sm text-left flex items-center justify-between"
      >
        <span className={selected.length > 0 ? 'text-tg' : 'text-tg-hint'}>
          {selected.length > 0 ? selectedNames.join(', ') : 'Selectionner des categories'}
        </span>
        <span className="text-tg-hint">{isOpen ? 'v' : '>'}</span>
      </button>

      {isOpen && (
        <div className="mt-2 max-h-64 overflow-y-auto bg-tg-section rounded-lg border border-gray-200 dark:border-gray-700 p-2">
          {DEFAULT_CATEGORIES.map(cat => renderCategory(cat))}
        </div>
      )}
    </div>
  );
}

function getSelectedNames(categories: Category[], selectedIds: number[]): string[] {
  const names: string[] = [];
  for (const cat of categories) {
    if (selectedIds.includes(cat.id)) {
      names.push(cat.name);
    }
    if (cat.children) {
      names.push(...getSelectedNames(cat.children, selectedIds));
    }
  }
  return names;
}

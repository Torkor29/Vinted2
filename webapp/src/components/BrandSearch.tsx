import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client.js';
import { POPULAR_BRANDS } from '../utils/constants.js';
import { hapticFeedback } from '../utils/telegram.js';

interface Brand {
  id: number;
  title: string;
}

interface Props {
  selected: Brand[];
  onChange: (brands: Brand[]) => void;
}

export default function BrandSearch({ selected, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const { data: results } = useQuery<Brand[]>({
    queryKey: ['brands', debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return [];
      const { data } = await api.get(`/catalog/brands?q=${encodeURIComponent(debouncedQuery)}`);
      return data.data;
    },
    enabled: debouncedQuery.length >= 2,
  });

  const addBrand = (brand: Brand) => {
    hapticFeedback('light');
    if (!selected.find(b => b.id === brand.id)) {
      onChange([...selected, brand]);
    }
    setQuery('');
    setIsOpen(false);
  };

  const removeBrand = (id: number) => {
    hapticFeedback('light');
    onChange(selected.filter(b => b.id !== id));
  };

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selected.map(brand => (
            <span
              key={brand.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-tg-button/10 text-tg-button rounded-full text-xs font-medium"
            >
              {brand.title}
              <button type="button" onClick={() => removeBrand(brand.id)} className="ml-0.5 text-tg-button/60 hover:text-tg-button">
                x
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder="Rechercher une marque..."
          className="w-full bg-tg-secondary rounded-lg px-3 py-2.5 text-sm text-tg outline-none focus:ring-2 focus:ring-tg-button/30"
        />

        {isOpen && (results?.length ?? 0) > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-tg-section rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg max-h-48 overflow-y-auto">
            {results?.map(brand => (
              <button
                key={brand.id}
                type="button"
                onClick={() => addBrand(brand)}
                className="w-full px-3 py-2 text-sm text-left text-tg hover:bg-tg-secondary"
              >
                {brand.title}
              </button>
            ))}
          </div>
        )}

        {isOpen && query.length < 2 && (
          <div className="absolute z-10 w-full mt-1 bg-tg-section rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg p-3">
            <div className="text-xs text-tg-hint mb-2">Marques populaires</div>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_BRANDS.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => { setQuery(name); setIsOpen(true); }}
                  className="px-2 py-1 bg-tg-secondary rounded-full text-xs text-tg hover:bg-tg-button/10"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Search } from 'lucide-react';
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
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const setQueryDebounced = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    if (value.length >= 2) {
      debounceRef.current = setTimeout(() => setDebouncedQuery(value), 280);
    } else {
      setDebouncedQuery('');
    }
  };

  // Bypass debounce for popular brand clicks — triggers search immediately
  const setQueryImmediate = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    setDebouncedQuery(value);
  };

  const { data: results, isFetching } = useQuery<Brand[]>({
    queryKey: ['brands', debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return [];
      const { data } = await api.get(`/catalog/brands?q=${encodeURIComponent(debouncedQuery)}`);
      return data.data;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
  });

  const addBrand = (brand: Brand) => {
    hapticFeedback('light');
    if (!selected.find(b => b.id === brand.id)) {
      onChange([...selected, brand]);
    }
    setQuery('');
    setDebouncedQuery('');
    setDropdownOpen(false);
  };

  const removeBrand = (id: number) => {
    hapticFeedback('light');
    onChange(selected.filter(b => b.id !== id));
  };

  const clearInput = () => {
    setQuery('');
    setDebouncedQuery('');
    setDropdownOpen(false);
    clearTimeout(debounceRef.current);
  };

  const showDropdown = dropdownOpen && debouncedQuery.length >= 2;
  const hasResults = (results?.length ?? 0) > 0;

  return (
    <div ref={wrapperRef}>

      {/* ── Selected brands ── */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {selected.map(brand => (
            <span
              key={brand.id}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '5px 10px 5px 12px', borderRadius: 20,
                background: 'rgba(124,58,237,0.15)', color: 'var(--button-color)',
                border: '1px solid rgba(124,58,237,0.3)', fontSize: 12, fontWeight: 600,
              }}
            >
              {brand.title}
              <button
                type="button"
                onClick={() => removeBrand(brand.id)}
                style={{
                  display: 'flex', alignItems: 'center', background: 'none',
                  border: 'none', cursor: 'pointer', padding: 2, opacity: 0.7,
                }}
              >
                <X size={11} color="var(--button-color)" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Search input ── */}
      <div style={{ position: 'relative' }}>
        <Search
          size={14}
          style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--hint-color)', pointerEvents: 'none',
          }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQueryDebounced(e.target.value); setDropdownOpen(true); }}
          onFocus={() => { if (debouncedQuery.length >= 2) setDropdownOpen(true); }}
          placeholder="Rechercher une marque…"
          style={{
            width: '100%', padding: '10px 36px 10px 34px', borderRadius: 10,
            background: 'var(--secondary-bg-color)', color: 'var(--text-color)',
            border: '1.5px solid var(--card-border)', fontSize: 14, outline: 'none',
            fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        {/* Loading spinner */}
        {isFetching && (
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <div className="anim-spin" style={{
              width: 14, height: 14, borderRadius: '50%',
              border: '2px solid var(--secondary-bg-color)',
              borderTopColor: 'var(--button-color)',
            }} />
          </div>
        )}
        {/* Clear button */}
        {query.length > 0 && !isFetching && (
          <button
            type="button"
            onClick={clearInput}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 3,
              display: 'flex', alignItems: 'center', color: 'var(--hint-color)',
            }}
          >
            <X size={13} />
          </button>
        )}

        {/* ── Autocomplete dropdown ── */}
        {showDropdown && (
          <div style={{
            position: 'absolute', zIndex: 50, width: '100%', marginTop: 4,
            background: 'var(--section-bg-color)', border: '1px solid var(--card-border)',
            borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            maxHeight: 220, overflowY: 'auto',
          }}>
            {isFetching && (
              <div style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--hint-color)', fontSize: 13 }}>
                Recherche en cours…
              </div>
            )}
            {!isFetching && hasResults && results!.map((brand, i) => (
              <button
                key={brand.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                onClick={() => addBrand(brand)}
                style={{
                  width: '100%', padding: '11px 14px', textAlign: 'left',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, color: 'var(--text-color)', fontFamily: 'inherit',
                  borderBottom: i < results!.length - 1 ? '1px solid var(--card-border)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <span>{brand.title}</span>
                <span style={{ fontSize: 11, color: 'var(--hint-color)', opacity: 0.5 }}>Ajouter</span>
              </button>
            ))}
            {!isFetching && !hasResults && (
              <div style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--hint-color)', fontSize: 13 }}>
                Aucun résultat pour «{query}»
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Popular brands ── */}
      <div style={{ marginTop: 14 }}>
        <p style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.7,
          color: 'var(--hint-color)', marginBottom: 8,
        }}>
          Suggestions
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {POPULAR_BRANDS.map(name => {
            const isSelected = selected.some(b => b.title.toLowerCase() === name.toLowerCase());
            return (
              <button
                key={name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (!isSelected) {
                    setQueryImmediate(name);
                    setDropdownOpen(true);
                    inputRef.current?.focus();
                  }
                }}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'inherit',
                  background: isSelected ? 'rgba(124,58,237,0.12)' : 'var(--secondary-bg-color)',
                  color: isSelected ? 'var(--button-color)' : 'var(--text-color)',
                  border: `1px solid ${isSelected ? 'rgba(124,58,237,0.25)' : 'var(--card-border)'}`,
                  cursor: isSelected ? 'default' : 'pointer',
                  fontWeight: 500, opacity: isSelected ? 0.55 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}

import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import { useFilter, useCreateFilter, useUpdateFilter } from '../hooks/useFilters.js';
import { useBackButton, useMainButton } from '../hooks/useTelegram.js';
import { hapticNotification, hapticFeedback } from '../utils/telegram.js';
import CategoryPicker from '../components/CategoryPicker.js';
import BrandSearch from '../components/BrandSearch.js';
import SizePicker from '../components/SizePicker.js';
import ColorPicker from '../components/ColorPicker.js';
import ConditionPicker from '../components/ConditionPicker.js';
import PriceRange from '../components/PriceRange.js';

interface FormState {
  name: string;
  search_text: string;
  catalog_ids: number[];
  brands: Array<{ id: number; title: string }>;
  size_ids: number[];
  color_ids: number[];
  status_ids: number[];
  price_from: number | null;
  price_to: number | null;
  sort_by: string;
  scan_interval_seconds: number;
  pepite_enabled: boolean;
  pepite_threshold: number;
}

const defaultForm: FormState = {
  name: '', search_text: '', catalog_ids: [], brands: [],
  size_ids: [], color_ids: [], status_ids: [],
  price_from: null, price_to: null,
  sort_by: 'newest_first', scan_interval_seconds: 3,
  pepite_enabled: true, pepite_threshold: 0.30,
};

export default function FilterEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const { data: existingFilter } = useFilter(id);
  const createFilter = useCreateFilter();
  const updateFilter = useUpdateFilter();

  const [form, setForm] = useState<FormState>(defaultForm);
  const [openSection, setOpenSection] = useState<string | null>('basic');

  useEffect(() => {
    if (existingFilter) {
      setForm({
        name: existingFilter.name,
        search_text: existingFilter.search_text ?? '',
        catalog_ids: existingFilter.catalog_ids ?? [],
        brands: [],
        size_ids: existingFilter.size_ids ?? [],
        color_ids: existingFilter.color_ids ?? [],
        status_ids: existingFilter.status_ids ?? [],
        price_from: existingFilter.price_from ? parseFloat(existingFilter.price_from) : null,
        price_to: existingFilter.price_to ? parseFloat(existingFilter.price_to) : null,
        sort_by: existingFilter.sort_by,
        scan_interval_seconds: existingFilter.scan_interval_seconds,
        pepite_enabled: existingFilter.pepite_enabled,
        pepite_threshold: parseFloat(existingFilter.pepite_threshold),
      });
    }
  }, [existingFilter]);

  const handleBack = useCallback(() => navigate('/filters'), [navigate]);
  useBackButton(handleBack);

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) { hapticNotification('error'); return; }

    const input = {
      name: form.name,
      search_text: form.search_text || null,
      catalog_ids: form.catalog_ids.length > 0 ? form.catalog_ids : null,
      brand_ids: form.brands.length > 0 ? form.brands.map(b => b.id) : null,
      size_ids: form.size_ids.length > 0 ? form.size_ids : null,
      color_ids: form.color_ids.length > 0 ? form.color_ids : null,
      status_ids: form.status_ids.length > 0 ? form.status_ids : null,
      price_from: form.price_from, price_to: form.price_to,
      sort_by: form.sort_by, scan_interval_seconds: form.scan_interval_seconds,
      pepite_enabled: form.pepite_enabled, pepite_threshold: form.pepite_threshold,
    };

    try {
      if (isEditing && id) {
        await updateFilter.mutateAsync({ id, ...input });
      } else {
        await createFilter.mutateAsync(input);
      }
      hapticNotification('success');
      navigate('/filters');
    } catch { hapticNotification('error'); }
  }, [form, isEditing, id, createFilter, updateFilter, navigate]);

  useMainButton(isEditing ? 'Enregistrer' : 'Créer le filtre', handleSave, form.name.trim().length > 0);

  const toggle = (key: string) => {
    hapticFeedback('light');
    setOpenSection(prev => prev === key ? null : key);
  };

  const badgeCount = (n: number) => n > 0 ? (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
      style={{ backgroundColor: 'var(--button-color)', color: '#fff' }}>
      {n}
    </span>
  ) : null;

  const Section = ({
    id: sId, title, badge, children,
  }: { id: string; title: string; badge?: React.ReactNode; children: React.ReactNode }) => {
    const open = openSection === sId;
    return (
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--section-bg-color)', border: '1px solid var(--card-border)' }}>
        <button
          type="button"
          onClick={() => toggle(sId)}
          className="w-full flex items-center justify-between px-4 py-3.5 transition-opacity active:opacity-70"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-color)' }}>{title}</span>
            {badge}
          </div>
          {open
            ? <ChevronDown size={16} style={{ color: 'var(--hint-color)' }} />
            : <ChevronRight size={16} style={{ color: 'var(--hint-color)' }} />
          }
        </button>
        {open && (
          <div className="px-4 pb-4 pt-0" style={{ borderTop: '1px solid var(--card-border)' }}>
            <div className="pt-3">{children}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <h1 className="text-lg font-bold" style={{ color: 'var(--text-color)' }}>
          {isEditing ? 'Modifier le filtre' : 'Nouveau filtre'}
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--hint-color)' }}>
          {isEditing ? 'Modifie les critères de recherche' : 'Configure tes critères de surveillance'}
        </p>
      </div>

      <div className="px-4 py-4 space-y-2 pb-32">

        {/* ── Name + search — always visible ───────────────────────── */}
        <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'var(--section-bg-color)', border: '1px solid var(--card-border)' }}>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--hint-color)' }}>
              Nom du filtre *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Nike Air Max"
              className="w-full rounded-xl px-3.5 py-3 text-sm outline-none border transition-colors"
              style={{
                backgroundColor: 'var(--secondary-bg-color)',
                color: 'var(--text-color)',
                borderColor: form.name ? 'var(--button-color)' : 'var(--card-border)',
              }}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--hint-color)' }}>
              Mots-clés de recherche
            </label>
            <input
              type="text"
              value={form.search_text}
              onChange={(e) => setForm({ ...form, search_text: e.target.value })}
              placeholder="Ex: air max 90 taille 42"
              className="w-full rounded-xl px-3.5 py-3 text-sm outline-none border"
              style={{
                backgroundColor: 'var(--secondary-bg-color)',
                color: 'var(--text-color)',
                borderColor: 'var(--card-border)',
              }}
            />
          </div>
        </div>

        {/* ── Sections ─────────────────────────────────────────────── */}
        <Section id="categories" title="Catégories" badge={badgeCount(form.catalog_ids.length)}>
          <CategoryPicker selected={form.catalog_ids} onChange={(ids) => setForm({ ...form, catalog_ids: ids })} />
        </Section>

        <Section id="brands" title="Marques" badge={badgeCount(form.brands.length)}>
          <BrandSearch selected={form.brands} onChange={(brands) => setForm({ ...form, brands })} />
        </Section>

        <Section id="sizes" title="Tailles" badge={badgeCount(form.size_ids.length)}>
          <SizePicker selected={form.size_ids} onChange={(ids) => setForm({ ...form, size_ids: ids })} />
        </Section>

        <Section id="colors" title="Couleurs" badge={badgeCount(form.color_ids.length)}>
          <ColorPicker selected={form.color_ids} onChange={(ids) => setForm({ ...form, color_ids: ids })} />
        </Section>

        <Section id="condition" title="État de l'article" badge={badgeCount(form.status_ids.length)}>
          <ConditionPicker selected={form.status_ids} onChange={(ids) => setForm({ ...form, status_ids: ids })} />
        </Section>

        <Section
          id="price"
          title="Fourchette de prix"
          badge={form.price_from || form.price_to ? (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--secondary-bg-color)', color: 'var(--accent-text-color)' }}>
              {form.price_from ?? 0} – {form.price_to ?? '∞'} €
            </span>
          ) : undefined}
        >
          <PriceRange min={form.price_from} max={form.price_to} onChange={(min, max) => setForm({ ...form, price_from: min, price_to: max })} />
        </Section>

        {/* ── Pépite toggle + settings ─────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--section-bg-color)', border: '1px solid var(--card-border)' }}>
          {/* Pepite row */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-color)' }}>Détection Pépites</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--hint-color)' }}>
                Alerter si {Math.round(form.pepite_threshold * 100)}% sous le prix du marché
              </div>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, pepite_enabled: !form.pepite_enabled })}
              className="relative flex-shrink-0 rounded-full transition-colors"
              style={{
                width: 44, height: 26,
                backgroundColor: form.pepite_enabled ? 'var(--success-color)' : 'var(--secondary-bg-color)',
              }}
            >
              <span
                className="absolute top-0.5 w-[22px] h-[22px] bg-white rounded-full shadow transition-transform"
                style={{ left: form.pepite_enabled ? 20 : 2 }}
              />
            </button>
          </div>

          {/* Threshold slider */}
          {form.pepite_enabled && (
            <div className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid var(--card-border)' }}>
              <div className="flex justify-between text-[10px] mb-2 mt-2" style={{ color: 'var(--hint-color)' }}>
                <span>Seuil minimum</span>
                <span style={{ color: 'var(--pepite-color)', fontWeight: 700 }}>
                  -{Math.round(form.pepite_threshold * 100)}%
                </span>
              </div>
              <input
                type="range" min="10" max="70"
                value={form.pepite_threshold * 100}
                onChange={(e) => setForm({ ...form, pepite_threshold: parseInt(e.target.value) / 100 })}
                className="w-full"
              />
            </div>
          )}
        </div>

        {/* ── Advanced settings ────────────────────────────────────── */}
        <Section id="settings" title="Paramètres avancés">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-[10px] mb-2" style={{ color: 'var(--hint-color)' }}>
                <span>Fréquence de scan</span>
                <span style={{ color: 'var(--text-color)', fontWeight: 600 }}>toutes les {form.scan_interval_seconds}s</span>
              </div>
              <input type="range" min="3" max="60" value={form.scan_interval_seconds}
                onChange={(e) => setForm({ ...form, scan_interval_seconds: parseInt(e.target.value) })} className="w-full" />
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide block mb-2" style={{ color: 'var(--hint-color)' }}>
                Trier par
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  { value: 'newest_first', label: 'Plus récents en premier' },
                  { value: 'price_low_to_high', label: 'Prix croissant' },
                  { value: 'price_high_to_low', label: 'Prix décroissant' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, sort_by: opt.value })}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-colors active:opacity-70"
                    style={{
                      backgroundColor: form.sort_by === opt.value ? 'rgba(108, 92, 231, 0.15)' : 'var(--secondary-bg-color)',
                      color: form.sort_by === opt.value ? 'var(--button-color)' : 'var(--text-color)',
                      border: `1px solid ${form.sort_by === opt.value ? 'rgba(108,92,231,0.3)' : 'transparent'}`,
                    }}
                  >
                    <span>{opt.label}</span>
                    {form.sort_by === opt.value && <Check size={14} style={{ color: 'var(--button-color)' }} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

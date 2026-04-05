import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFilter, useCreateFilter, useUpdateFilter } from '../hooks/useFilters.js';
import { useBackButton, useMainButton } from '../hooks/useTelegram.js';
import { hapticNotification } from '../utils/telegram.js';
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

  useMainButton(isEditing ? 'Enregistrer' : 'Creer le filtre', handleSave, form.name.trim().length > 0);

  const toggleSection = (key: string) => {
    setOpenSection(openSection === key ? null : key);
  };

  const Section = ({ id: sId, title, badge, children }: { id: string; title: string; badge?: string; children: React.ReactNode }) => (
    <div className="bg-tg-section rounded-xl border border-[var(--card-border)] overflow-hidden">
      <button
        type="button"
        onClick={() => toggleSection(sId)}
        className="w-full px-3 py-2.5 flex items-center justify-between active:bg-tg-secondary transition-colors"
      >
        <span className="text-xs font-semibold text-tg">{title}</span>
        <div className="flex items-center gap-2">
          {badge && <span className="text-[10px] text-tg-accent bg-tg-secondary px-1.5 py-0.5 rounded">{badge}</span>}
          <span className="text-tg-hint text-[10px]">{openSection === sId ? '▼' : '▶'}</span>
        </div>
      </button>
      {openSection === sId && (
        <div className="px-3 pb-3 border-t border-[var(--card-border)]  pt-3">{children}</div>
      )}
    </div>
  );

  return (
    <div className="px-4 pt-4 pb-24 max-w-full overflow-hidden space-y-2">
      <h1 className="text-lg font-bold text-tg mb-3">
        {isEditing ? 'Modifier le filtre' : 'Nouveau filtre'}
      </h1>

      <Section id="basic" title="Informations de base">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-tg-hint block mb-1">Nom du filtre *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Nike pas cher"
              className="w-full bg-tg-secondary rounded-lg px-3 py-2 text-sm text-tg outline-none border border-transparent focus:border-[var(--button-color)]"
            />
          </div>
          <div>
            <label className="text-[10px] text-tg-hint block mb-1">Recherche</label>
            <input
              type="text"
              value={form.search_text}
              onChange={(e) => setForm({ ...form, search_text: e.target.value })}
              placeholder="Ex: air max 90"
              className="w-full bg-tg-secondary rounded-lg px-3 py-2 text-sm text-tg outline-none border border-transparent focus:border-[var(--button-color)]"
            />
          </div>
        </div>
      </Section>

      <Section id="categories" title="Categories" badge={form.catalog_ids.length > 0 ? `${form.catalog_ids.length}` : undefined}>
        <CategoryPicker selected={form.catalog_ids} onChange={(ids) => setForm({ ...form, catalog_ids: ids })} />
      </Section>

      <Section id="brands" title="Marques" badge={form.brands.length > 0 ? `${form.brands.length}` : undefined}>
        <BrandSearch selected={form.brands} onChange={(brands) => setForm({ ...form, brands })} />
      </Section>

      <Section id="sizes" title="Tailles" badge={form.size_ids.length > 0 ? `${form.size_ids.length}` : undefined}>
        <SizePicker selected={form.size_ids} onChange={(ids) => setForm({ ...form, size_ids: ids })} />
      </Section>

      <Section id="colors" title="Couleurs" badge={form.color_ids.length > 0 ? `${form.color_ids.length}` : undefined}>
        <ColorPicker selected={form.color_ids} onChange={(ids) => setForm({ ...form, color_ids: ids })} />
      </Section>

      <Section id="condition" title="Etat" badge={form.status_ids.length > 0 ? `${form.status_ids.length}` : undefined}>
        <ConditionPicker selected={form.status_ids} onChange={(ids) => setForm({ ...form, status_ids: ids })} />
      </Section>

      <Section id="price" title="Prix" badge={form.price_from || form.price_to ? `${form.price_from ?? 0}-${form.price_to ?? '∞'}` : undefined}>
        <PriceRange min={form.price_from} max={form.price_to} onChange={(min, max) => setForm({ ...form, price_from: min, price_to: max })} />
      </Section>

      <Section id="settings" title="Parametres">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-tg-hint block mb-1">Intervalle : {form.scan_interval_seconds}s</label>
            <input type="range" min="3" max="60" value={form.scan_interval_seconds}
              onChange={(e) => setForm({ ...form, scan_interval_seconds: parseInt(e.target.value) })} className="w-full" />
          </div>
          <div>
            <label className="text-[10px] text-tg-hint block mb-1">Tri</label>
            <select value={form.sort_by} onChange={(e) => setForm({ ...form, sort_by: e.target.value })}
              className="w-full bg-tg-secondary rounded-lg px-3 py-2 text-sm text-tg outline-none border border-transparent">
              <option value="newest_first">Plus recents</option>
              <option value="price_low_to_high">Prix croissant</option>
              <option value="price_high_to_low">Prix decroissant</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-tg">Detection pepites 💎</span>
            <button type="button" onClick={() => setForm({ ...form, pepite_enabled: !form.pepite_enabled })}
              className={`w-11 h-6 rounded-full relative flex-shrink-0 transition-colors ${form.pepite_enabled ? 'bg-[var(--success-color)]' : 'bg-gray-600'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.pepite_enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {form.pepite_enabled && (
            <div>
              <label className="text-[10px] text-tg-hint block mb-1">Seuil : {Math.round(form.pepite_threshold * 100)}% sous le marche</label>
              <input type="range" min="10" max="70" value={form.pepite_threshold * 100}
                onChange={(e) => setForm({ ...form, pepite_threshold: parseInt(e.target.value) / 100 })} className="w-full" />
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

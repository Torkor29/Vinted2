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
  name: '',
  search_text: '',
  catalog_ids: [],
  brands: [],
  size_ids: [],
  color_ids: [],
  status_ids: [],
  price_from: null,
  price_to: null,
  sort_by: 'newest_first',
  scan_interval_seconds: 3,
  pepite_enabled: true,
  pepite_threshold: 0.30,
};

export default function FilterEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const { data: existingFilter } = useFilter(id);
  const createFilter = useCreateFilter();
  const updateFilter = useUpdateFilter();

  const [form, setForm] = useState<FormState>(defaultForm);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic']));

  useEffect(() => {
    if (existingFilter) {
      setForm({
        name: existingFilter.name,
        search_text: existingFilter.search_text ?? '',
        catalog_ids: existingFilter.catalog_ids ?? [],
        brands: [], // Will be populated from brand_ids
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
    if (!form.name.trim()) {
      hapticNotification('error');
      return;
    }

    const input = {
      name: form.name,
      search_text: form.search_text || null,
      catalog_ids: form.catalog_ids.length > 0 ? form.catalog_ids : null,
      brand_ids: form.brands.length > 0 ? form.brands.map(b => b.id) : null,
      size_ids: form.size_ids.length > 0 ? form.size_ids : null,
      color_ids: form.color_ids.length > 0 ? form.color_ids : null,
      status_ids: form.status_ids.length > 0 ? form.status_ids : null,
      price_from: form.price_from,
      price_to: form.price_to,
      sort_by: form.sort_by,
      scan_interval_seconds: form.scan_interval_seconds,
      pepite_enabled: form.pepite_enabled,
      pepite_threshold: form.pepite_threshold,
    };

    try {
      if (isEditing && id) {
        await updateFilter.mutateAsync({ id, ...input });
      } else {
        await createFilter.mutateAsync(input);
      }
      hapticNotification('success');
      navigate('/filters');
    } catch {
      hapticNotification('error');
    }
  }, [form, isEditing, id, createFilter, updateFilter, navigate]);

  useMainButton(
    isEditing ? 'Enregistrer' : 'Creer le filtre',
    handleSave,
    form.name.trim().length > 0,
  );

  const toggleSection = (key: string) => {
    const next = new Set(expandedSections);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpandedSections(next);
  };

  const Section = ({ id: sectionId, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <div className="bg-tg-section rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => toggleSection(sectionId)}
        className="w-full px-4 py-3 flex items-center justify-between"
      >
        <span className="text-sm font-semibold text-tg">{title}</span>
        <span className="text-tg-hint text-xs">{expandedSections.has(sectionId) ? 'v' : '>'}</span>
      </button>
      {expandedSections.has(sectionId) && (
        <div className="px-4 pb-4">{children}</div>
      )}
    </div>
  );

  return (
    <div className="p-4 pb-24 space-y-3">
      <h1 className="text-xl font-bold text-tg mb-4">
        {isEditing ? 'Modifier le filtre' : 'Nouveau filtre'}
      </h1>

      {/* Name & search */}
      <Section id="basic" title="Informations de base">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-tg-hint block mb-1">Nom du filtre *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Nike pas cher"
              className="w-full bg-tg-secondary rounded-lg px-3 py-2.5 text-sm text-tg outline-none focus:ring-2 focus:ring-tg-button/30"
            />
          </div>
          <div>
            <label className="text-xs text-tg-hint block mb-1">Recherche textuelle</label>
            <input
              type="text"
              value={form.search_text}
              onChange={(e) => setForm({ ...form, search_text: e.target.value })}
              placeholder="Ex: air max 90"
              className="w-full bg-tg-secondary rounded-lg px-3 py-2.5 text-sm text-tg outline-none focus:ring-2 focus:ring-tg-button/30"
            />
          </div>
        </div>
      </Section>

      <Section id="categories" title="Categories">
        <CategoryPicker
          selected={form.catalog_ids}
          onChange={(ids) => setForm({ ...form, catalog_ids: ids })}
        />
      </Section>

      <Section id="brands" title="Marques">
        <BrandSearch
          selected={form.brands}
          onChange={(brands) => setForm({ ...form, brands })}
        />
      </Section>

      <Section id="sizes" title="Tailles">
        <SizePicker
          selected={form.size_ids}
          onChange={(ids) => setForm({ ...form, size_ids: ids })}
        />
      </Section>

      <Section id="colors" title="Couleurs">
        <ColorPicker
          selected={form.color_ids}
          onChange={(ids) => setForm({ ...form, color_ids: ids })}
        />
      </Section>

      <Section id="condition" title="Etat">
        <ConditionPicker
          selected={form.status_ids}
          onChange={(ids) => setForm({ ...form, status_ids: ids })}
        />
      </Section>

      <Section id="price" title="Prix">
        <PriceRange
          min={form.price_from}
          max={form.price_to}
          onChange={(min, max) => setForm({ ...form, price_from: min, price_to: max })}
        />
      </Section>

      <Section id="settings" title="Parametres du filtre">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-tg-hint block mb-1">
              Intervalle de scan : {form.scan_interval_seconds}s
            </label>
            <input
              type="range"
              min="3"
              max="60"
              value={form.scan_interval_seconds}
              onChange={(e) => setForm({ ...form, scan_interval_seconds: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-tg-hint">
              <span>3s</span>
              <span>60s</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-tg-hint block mb-1">Tri</label>
            <select
              value={form.sort_by}
              onChange={(e) => setForm({ ...form, sort_by: e.target.value })}
              className="w-full bg-tg-secondary rounded-lg px-3 py-2.5 text-sm text-tg outline-none"
            >
              <option value="newest_first">Plus recents</option>
              <option value="price_low_to_high">Prix croissant</option>
              <option value="price_high_to_low">Prix decroissant</option>
              <option value="relevance">Pertinence</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-tg">Detection pepites</div>
              <div className="text-xs text-tg-hint">Detecter les bonnes affaires</div>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, pepite_enabled: !form.pepite_enabled })}
              className={`w-12 h-7 rounded-full relative transition-colors ${
                form.pepite_enabled ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                form.pepite_enabled ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {form.pepite_enabled && (
            <div>
              <label className="text-xs text-tg-hint block mb-1">
                Seuil pepite : {Math.round(form.pepite_threshold * 100)}% sous le marche
              </label>
              <input
                type="range"
                min="10"
                max="70"
                value={form.pepite_threshold * 100}
                onChange={(e) => setForm({ ...form, pepite_threshold: parseInt(e.target.value) / 100 })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-tg-hint">
                <span>10%</span>
                <span>70%</span>
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

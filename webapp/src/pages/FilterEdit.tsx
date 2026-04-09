import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, ArrowLeft, Gem } from 'lucide-react';
import { useFilter, useCreateFilter, useUpdateFilter } from '../hooks/useFilters.js';
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
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) { hapticNotification('error'); return; }
    setSaving(true);
    const input = {
      name: form.name, search_text: form.search_text || null,
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
      if (isEditing && id) { await updateFilter.mutateAsync({ id, ...input }); }
      else { await createFilter.mutateAsync(input); }
      hapticNotification('success');
      navigate('/filters');
    } catch {
      hapticNotification('error');
    } finally {
      setSaving(false);
    }
  }, [form, isEditing, id, createFilter, updateFilter, navigate]);

  const toggle = (key: string) => { hapticFeedback('light'); setOpenSection(prev => prev === key ? null : key); };

  const Badge = ({ n }: { n: number }) => n > 0 ? (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
      background: 'var(--button-color)', color: '#fff', marginLeft: 6,
    }}>{n}</span>
  ) : null;

  const Section = ({ sId, title, badge, children }: {
    sId: string; title: string; badge?: React.ReactNode; children: React.ReactNode;
  }) => {
    const open = openSection === sId;
    return (
      <div style={{
        background: 'var(--section-bg-color)', border: '1px solid var(--card-border)',
        borderRadius: 14, overflow: 'hidden', marginBottom: 8,
      }}>
        <button type="button" onClick={() => toggle(sId)} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-color)' }}>{title}</span>
            {badge}
          </div>
          {open
            ? <ChevronDown size={16} style={{ color: 'var(--hint-color)' }} />
            : <ChevronRight size={16} style={{ color: 'var(--hint-color)' }} />}
        </button>
        {open && (
          <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--card-border)' }}>
            <div style={{ paddingTop: 12 }}>{children}</div>
          </div>
        )}
      </div>
    );
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 16px', borderRadius: 12,
    background: 'var(--secondary-bg-color)', color: 'var(--text-color)',
    border: '1px solid var(--card-border)', fontSize: 15, outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const,
    letterSpacing: 0.6, color: 'var(--hint-color)', marginBottom: 7, display: 'block',
  };

  const canSave = form.name.trim().length > 0;

  return (
    <div style={{ background: 'var(--bg-color)', minHeight: '100vh', paddingBottom: 80 }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 16px 14px',
        borderBottom: '1px solid var(--card-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <button
          onClick={() => navigate('/filters')}
          style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--secondary-bg-color)', border: '1px solid var(--card-border)',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={17} style={{ color: 'var(--hint-color)' }} />
        </button>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-color)', lineHeight: 1.2 }}>
            {isEditing ? 'Modifier le filtre' : 'Nouveau filtre'}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--hint-color)', marginTop: 2 }}>
            {isEditing ? 'Modifie les critères' : 'Configure la surveillance'}
          </p>
        </div>
      </div>

      <div style={{ padding: '14px 16px' }}>

        {/* ── Name + search ──────────────────────────────────── */}
        <div style={{
          background: 'var(--section-bg-color)', border: '1px solid var(--card-border)',
          borderRadius: 14, padding: 16, marginBottom: 8,
        }}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Nom du filtre *</label>
            <input
              type="text" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex : Nike Air Max"
              style={{
                ...inputStyle,
                borderColor: form.name ? 'rgba(124, 58, 237, 0.5)' : 'var(--card-border)',
              }}
            />
          </div>
          <div>
            <label style={labelStyle}>Mots-clés de recherche</label>
            <input
              type="text" value={form.search_text}
              onChange={(e) => setForm({ ...form, search_text: e.target.value })}
              placeholder="Ex : air max 90 taille 42"
              style={inputStyle}
            />
          </div>
        </div>

        {/* ── Accordion sections ─────────────────────────────── */}
        <Section sId="categories" title="Catégories" badge={<Badge n={form.catalog_ids.length} />}>
          <CategoryPicker selected={form.catalog_ids} onChange={(ids) => setForm({ ...form, catalog_ids: ids })} />
        </Section>

        <Section sId="brands" title="Marques" badge={<Badge n={form.brands.length} />}>
          <BrandSearch selected={form.brands} onChange={(brands) => setForm({ ...form, brands })} />
        </Section>

        <Section sId="sizes" title="Tailles" badge={<Badge n={form.size_ids.length} />}>
          <SizePicker selected={form.size_ids} onChange={(ids) => setForm({ ...form, size_ids: ids })} />
        </Section>

        <Section sId="colors" title="Couleurs" badge={<Badge n={form.color_ids.length} />}>
          <ColorPicker selected={form.color_ids} onChange={(ids) => setForm({ ...form, color_ids: ids })} />
        </Section>

        <Section sId="condition" title="État de l'article" badge={<Badge n={form.status_ids.length} />}>
          <ConditionPicker selected={form.status_ids} onChange={(ids) => setForm({ ...form, status_ids: ids })} />
        </Section>

        <Section sId="price" title="Fourchette de prix" badge={
          (form.price_from || form.price_to) ? (
            <span style={{
              fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
              background: 'var(--secondary-bg-color)', color: 'var(--accent-text-color)', marginLeft: 6,
            }}>
              {form.price_from ?? 0}–{form.price_to ?? '∞'} €
            </span>
          ) : undefined
        }>
          <PriceRange min={form.price_from} max={form.price_to} onChange={(min, max) => setForm({ ...form, price_from: min, price_to: max })} />
        </Section>

        {/* ── Pépite detection ───────────────────────────────── */}
        <div style={{
          background: 'var(--section-bg-color)', border: '1px solid var(--card-border)',
          borderRadius: 14, overflow: 'hidden', marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: form.pepite_enabled ? 'var(--pepite-bg)' : 'var(--secondary-bg-color)',
              }}>
                <Gem size={15} style={{ color: form.pepite_enabled ? 'var(--pepite-color)' : 'var(--hint-color)' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-color)' }}>
                  Détection Pépites
                </div>
                <div style={{ fontSize: 11, color: 'var(--hint-color)', marginTop: 1 }}>
                  Alerter si -{Math.round(form.pepite_threshold * 100)}% sous le marché
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, pepite_enabled: !form.pepite_enabled })}
              style={{
                width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                position: 'relative', flexShrink: 0,
                background: form.pepite_enabled ? 'var(--success-color)' : 'var(--secondary-bg-color)',
                transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute', top: 3, width: 20, height: 20, borderRadius: 10,
                background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                transition: 'transform 0.2s',
                transform: form.pepite_enabled ? 'translateX(23px)' : 'translateX(3px)',
              }} />
            </button>
          </div>

          {form.pepite_enabled && (
            <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--card-border)' }}>
              <div style={{ paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--hint-color)' }}>Seuil minimum</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--pepite-color)' }}>
                    -{Math.round(form.pepite_threshold * 100)}%
                  </span>
                </div>
                <input type="range" min="10" max="70"
                  value={form.pepite_threshold * 100}
                  onChange={(e) => setForm({ ...form, pepite_threshold: parseInt(e.target.value) / 100 })}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--hint-color)', marginTop: 4 }}>
                  <span>-10%</span><span>-70%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Advanced ───────────────────────────────────────── */}
        <Section sId="advanced" title="Paramètres avancés">
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--hint-color)' }}>Intervalle de scan</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-text-color)' }}>
                {form.scan_interval_seconds}s
              </span>
            </div>
            <input type="range" min="3" max="60"
              value={form.scan_interval_seconds}
              onChange={(e) => setForm({ ...form, scan_interval_seconds: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--hint-color)', marginTop: 4 }}>
              <span>3s (rapide)</span><span>60s (lent)</span>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Ordre de tri</label>
            <select value={form.sort_by} onChange={(e) => setForm({ ...form, sort_by: e.target.value })}
              style={{ ...inputStyle }}>
              <option value="newest_first">Plus récents d'abord</option>
              <option value="price_low_to_high">Prix croissant</option>
              <option value="price_high_to_low">Prix décroissant</option>
              <option value="relevance">Pertinence</option>
            </select>
          </div>
        </Section>
      </div>

      {/* ── Save bar ────────────────────────────────────────────── */}
      <div className="save-bar">
        <button className="btn-cancel" onClick={() => navigate('/filters')}>
          Annuler
        </button>
        <button
          className="btn-save"
          onClick={handleSave}
          disabled={!canSave || saving}
        >
          {saving ? 'Enregistrement…' : isEditing ? 'Enregistrer' : 'Créer le filtre'}
        </button>
      </div>
    </div>
  );
}

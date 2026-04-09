import { useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useCreatePurchase, useUpdatePurchase } from '../hooks/usePurchases.js';
import { hapticNotification } from '../utils/telegram.js';

export default function PurchaseEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = !!id;

  const createPurchase = useCreatePurchase();
  const updatePurchase = useUpdatePurchase();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title:             searchParams.get('title') ?? '',
    brand_name:        searchParams.get('brand') ?? '',
    vinted_url:        searchParams.get('url') ?? '',
    photo_url:         searchParams.get('photo') ?? '',
    purchase_price:    searchParams.get('price') ?? '',
    shipping_cost:     '0',
    sold_price:        '',
    sold_platform_fee: '',
    status:            'purchased',
    notes:             '',
  });

  const canSave = form.title.trim().length > 0 && !!form.purchase_price;

  const handleSave = useCallback(async () => {
    if (!canSave) { hapticNotification('error'); return; }
    setSaving(true);
    try {
      if (isEditing && id) {
        await updatePurchase.mutateAsync({
          id, is_sold: form.status === 'sold',
          sold_price: form.sold_price ? parseFloat(form.sold_price) : null,
          sold_platform_fee: form.sold_platform_fee ? parseFloat(form.sold_platform_fee) : null,
          sold_date: form.status === 'sold' ? new Date().toISOString() : null,
          status: form.status, notes: form.notes || null,
        });
      } else {
        const articleId = searchParams.get('articleId');
        await createPurchase.mutateAsync({
          article_id: articleId ? parseInt(articleId) : null,
          title: form.title, brand_name: form.brand_name || null,
          vinted_url: form.vinted_url || null, photo_url: form.photo_url || null,
          purchase_price: parseFloat(form.purchase_price),
          shipping_cost: parseFloat(form.shipping_cost) || 0,
          status: form.status, notes: form.notes || null,
        });
      }
      hapticNotification('success');
      navigate('/purchases');
    } catch {
      hapticNotification('error');
    } finally {
      setSaving(false);
    }
  }, [form, isEditing, id, canSave, createPurchase, updatePurchase, navigate, searchParams]);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 16px', borderRadius: 12,
    background: 'var(--secondary-bg-color)', color: 'var(--text-color)',
    border: '1px solid var(--card-border)', fontSize: 15, outline: 'none',
    fontFamily: 'inherit',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const,
    letterSpacing: 0.6, color: 'var(--hint-color)', marginBottom: 7, display: 'block',
  };

  const sectionStyle: React.CSSProperties = {
    background: 'var(--section-bg-color)', border: '1px solid var(--card-border)',
    borderRadius: 14, padding: 16, marginBottom: 8,
  };

  const Field = ({ label, value, onChange, placeholder, type = 'text', suffix }: {
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; type?: string; suffix?: string;
  }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={type} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            ...inputStyle,
            paddingRight: suffix ? 44 : 16,
          }}
        />
        {suffix && (
          <span style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 11, color: 'var(--hint-color)', fontWeight: 600,
          }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );

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
          onClick={() => navigate('/purchases')}
          style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--secondary-bg-color)', border: '1px solid var(--card-border)',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={17} style={{ color: 'var(--hint-color)' }} />
        </button>
        <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-color)' }}>
          {isEditing ? 'Modifier l\'achat' : 'Nouvel achat'}
        </h1>
      </div>

      <div style={{ padding: '14px 16px' }}>

        {/* ── Article ─────────────────────────────────────────── */}
        <div style={sectionStyle}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--hint-color)', marginBottom: 14 }}>
            Article
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Titre *" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Nom de l'article" />
            <Field label="Marque" value={form.brand_name} onChange={(v) => setForm({ ...form, brand_name: v })} placeholder="Nike" />
            <Field label="Lien Vinted" value={form.vinted_url} onChange={(v) => setForm({ ...form, vinted_url: v })} placeholder="https://vinted.fr/…" type="url" />
          </div>
        </div>

        {/* ── Prix d'achat ────────────────────────────────────── */}
        <div style={sectionStyle}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--hint-color)', marginBottom: 14 }}>
            Achat
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Prix achat *" value={form.purchase_price} onChange={(v) => setForm({ ...form, purchase_price: v })} placeholder="0" type="number" suffix="€" />
            <Field label="Frais port" value={form.shipping_cost} onChange={(v) => setForm({ ...form, shipping_cost: v })} placeholder="0" type="number" suffix="€" />
          </div>
        </div>

        {/* ── Revente (édition seulement) ─────────────────────── */}
        {isEditing && (
          <div style={sectionStyle}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--hint-color)', marginBottom: 14 }}>
              Revente
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Prix vente" value={form.sold_price} onChange={(v) => setForm({ ...form, sold_price: v })} placeholder="0" type="number" suffix="€" />
              <Field label="Commission" value={form.sold_platform_fee} onChange={(v) => setForm({ ...form, sold_platform_fee: v })} placeholder="0" type="number" suffix="€" />
            </div>
          </div>
        )}

        {/* ── Statut + Notes ──────────────────────────────────── */}
        <div style={sectionStyle}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--hint-color)', marginBottom: 14 }}>
            Statut
          </p>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Statut</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              style={inputStyle}
            >
              <option value="purchased">En stock</option>
              <option value="listed">En vente</option>
              <option value="sold">Vendu</option>
              <option value="returned">Retourné</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes optionnelles…"
              rows={3}
              style={{
                ...inputStyle,
                resize: 'none',
                lineHeight: 1.5,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Save bar ────────────────────────────────────────────── */}
      <div className="save-bar">
        <button className="btn-cancel" onClick={() => navigate('/purchases')}>
          Annuler
        </button>
        <button
          className="btn-save"
          onClick={handleSave}
          disabled={!canSave || saving}
        >
          {saving ? 'Enregistrement…' : isEditing ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </div>
  );
}

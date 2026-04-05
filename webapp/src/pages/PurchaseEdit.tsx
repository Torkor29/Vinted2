import { useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCreatePurchase, useUpdatePurchase } from '../hooks/usePurchases.js';
import { useBackButton, useMainButton } from '../hooks/useTelegram.js';
import { hapticNotification } from '../utils/telegram.js';

export default function PurchaseEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = !!id;

  const createPurchase = useCreatePurchase();
  const updatePurchase = useUpdatePurchase();

  const [form, setForm] = useState({
    title: searchParams.get('title') ?? '',
    brand_name: searchParams.get('brand') ?? '',
    vinted_url: searchParams.get('url') ?? '',
    photo_url: searchParams.get('photo') ?? '',
    purchase_price: searchParams.get('price') ?? '',
    shipping_cost: '0',
    sold_price: '',
    sold_platform_fee: '',
    status: 'purchased',
    notes: '',
  });

  const handleBack = useCallback(() => navigate('/purchases'), [navigate]);
  useBackButton(handleBack);

  const handleSave = useCallback(async () => {
    if (!form.title.trim() || !form.purchase_price) { hapticNotification('error'); return; }
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
    } catch { hapticNotification('error'); }
  }, [form, isEditing, id, createPurchase, updatePurchase, navigate, searchParams]);

  useMainButton(isEditing ? 'Enregistrer' : 'Ajouter', handleSave, form.title.trim().length > 0 && !!form.purchase_price);

  const Input = ({ label, value, onChange, placeholder, type = 'text', suffix }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; suffix?: string }) => (
    <div>
      <label className="text-[10px] text-tg-hint block mb-1">{label}</label>
      <div className="relative">
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="w-full bg-tg-secondary rounded-lg px-3 py-2 text-sm text-tg outline-none border border-transparent focus:border-[var(--button-color)]" />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-tg-hint">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="px-4 pt-4 pb-24 max-w-full overflow-hidden space-y-3">
      <h1 className="text-lg font-bold text-tg mb-3">{isEditing ? 'Modifier' : 'Nouvel achat'}</h1>

      <div className="bg-tg-section rounded-xl border border-[var(--card-border)] p-3 space-y-3">
        <div className="text-[10px] font-semibold text-tg-section-header uppercase">Article</div>
        <Input label="Titre *" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Nom de l'article" />
        <Input label="Marque" value={form.brand_name} onChange={(v) => setForm({ ...form, brand_name: v })} placeholder="Nike" />
        <Input label="Lien Vinted" value={form.vinted_url} onChange={(v) => setForm({ ...form, vinted_url: v })} placeholder="https://vinted.fr/..." type="url" />
      </div>

      <div className="bg-tg-section rounded-xl border border-[var(--card-border)] p-3 space-y-3">
        <div className="text-[10px] font-semibold text-tg-section-header uppercase">Achat</div>
        <div className="grid grid-cols-2 gap-2">
          <Input label="Prix d'achat *" value={form.purchase_price} onChange={(v) => setForm({ ...form, purchase_price: v })} placeholder="0.00" type="number" suffix="EUR" />
          <Input label="Frais port" value={form.shipping_cost} onChange={(v) => setForm({ ...form, shipping_cost: v })} placeholder="0.00" type="number" suffix="EUR" />
        </div>
      </div>

      {isEditing && (
        <div className="bg-tg-section rounded-xl border border-[var(--card-border)] p-3 space-y-3">
          <div className="text-[10px] font-semibold text-tg-section-header uppercase">Revente</div>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Prix vente" value={form.sold_price} onChange={(v) => setForm({ ...form, sold_price: v })} placeholder="0.00" type="number" suffix="EUR" />
            <Input label="Commission" value={form.sold_platform_fee} onChange={(v) => setForm({ ...form, sold_platform_fee: v })} placeholder="0.00" type="number" suffix="EUR" />
          </div>
        </div>
      )}

      <div className="bg-tg-section rounded-xl border border-[var(--card-border)] p-3 space-y-3">
        <div className="text-[10px] font-semibold text-tg-section-header uppercase">Statut</div>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
          className="w-full bg-tg-secondary rounded-lg px-3 py-2 text-sm text-tg outline-none border border-transparent">
          <option value="purchased">En stock</option>
          <option value="listed">En vente</option>
          <option value="sold">Vendu</option>
          <option value="returned">Retourne</option>
        </select>
        <div>
          <label className="text-[10px] text-tg-hint block mb-1">Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes..."
            rows={2} className="w-full bg-tg-secondary rounded-lg px-3 py-2 text-sm text-tg outline-none resize-none border border-transparent focus:border-[var(--button-color)]" />
        </div>
      </div>
    </div>
  );
}

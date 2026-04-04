import { useState, useCallback, useEffect } from 'react';
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
    if (!form.title.trim() || !form.purchase_price) {
      hapticNotification('error');
      return;
    }

    try {
      if (isEditing && id) {
        await updatePurchase.mutateAsync({
          id,
          is_sold: form.status === 'sold',
          sold_price: form.sold_price ? parseFloat(form.sold_price) : null,
          sold_platform_fee: form.sold_platform_fee ? parseFloat(form.sold_platform_fee) : null,
          sold_date: form.status === 'sold' ? new Date().toISOString() : null,
          status: form.status,
          notes: form.notes || null,
        });
      } else {
        const articleId = searchParams.get('articleId');
        await createPurchase.mutateAsync({
          article_id: articleId ? parseInt(articleId) : null,
          title: form.title,
          brand_name: form.brand_name || null,
          vinted_url: form.vinted_url || null,
          photo_url: form.photo_url || null,
          purchase_price: parseFloat(form.purchase_price),
          shipping_cost: parseFloat(form.shipping_cost) || 0,
          status: form.status,
          notes: form.notes || null,
        });
      }
      hapticNotification('success');
      navigate('/purchases');
    } catch {
      hapticNotification('error');
    }
  }, [form, isEditing, id, createPurchase, updatePurchase, navigate, searchParams]);

  useMainButton(
    isEditing ? 'Enregistrer' : 'Ajouter l\'achat',
    handleSave,
    form.title.trim().length > 0 && !!form.purchase_price,
  );

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold text-tg mb-4">
        {isEditing ? 'Modifier l\'achat' : 'Nouvel achat'}
      </h1>

      <div className="bg-tg-section rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-semibold text-tg-section-header">Informations</h2>

        <div>
          <label className="text-xs text-tg-hint block mb-1">Titre *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Nom de l'article"
            className="w-full bg-tg-secondary rounded-lg px-3 py-2.5 text-sm text-tg outline-none focus:ring-2 focus:ring-tg-button/30"
          />
        </div>

        <div>
          <label className="text-xs text-tg-hint block mb-1">Marque</label>
          <input
            type="text"
            value={form.brand_name}
            onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
            placeholder="Ex: Nike"
            className="w-full bg-tg-secondary rounded-lg px-3 py-2.5 text-sm text-tg outline-none focus:ring-2 focus:ring-tg-button/30"
          />
        </div>

        <div>
          <label className="text-xs text-tg-hint block mb-1">Lien Vinted</label>
          <input
            type="url"
            value={form.vinted_url}
            onChange={(e) => setForm({ ...form, vinted_url: e.target.value })}
            placeholder="https://www.vinted.fr/..."
            className="w-full bg-tg-secondary rounded-lg px-3 py-2.5 text-sm text-tg outline-none focus:ring-2 focus:ring-tg-button/30"
          />
        </div>
      </div>

      <div className="bg-tg-section rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-semibold text-tg-section-header">Achat</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-tg-hint block mb-1">Prix d'achat * (EUR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.purchase_price}
              onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
              placeholder="0.00"
              className="w-full bg-tg-secondary rounded-lg px-3 py-2.5 text-sm text-tg outline-none focus:ring-2 focus:ring-tg-button/30"
            />
          </div>
          <div>
            <label className="text-xs text-tg-hint block mb-1">Frais de port (EUR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.shipping_cost}
              onChange={(e) => setForm({ ...form, shipping_cost: e.target.value })}
              placeholder="0.00"
              className="w-full bg-tg-secondary rounded-lg px-3 py-2.5 text-sm text-tg outline-none focus:ring-2 focus:ring-tg-button/30"
            />
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="bg-tg-section rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-semibold text-tg-section-header">Revente</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-tg-hint block mb-1">Prix de vente (EUR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.sold_price}
                onChange={(e) => setForm({ ...form, sold_price: e.target.value })}
                placeholder="0.00"
                className="w-full bg-tg-secondary rounded-lg px-3 py-2.5 text-sm text-tg outline-none focus:ring-2 focus:ring-tg-button/30"
              />
            </div>
            <div>
              <label className="text-xs text-tg-hint block mb-1">Commission (EUR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.sold_platform_fee}
                onChange={(e) => setForm({ ...form, sold_platform_fee: e.target.value })}
                placeholder="0.00"
                className="w-full bg-tg-secondary rounded-lg px-3 py-2.5 text-sm text-tg outline-none focus:ring-2 focus:ring-tg-button/30"
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-tg-section rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-semibold text-tg-section-header">Statut</h2>

        <div>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full bg-tg-secondary rounded-lg px-3 py-2.5 text-sm text-tg outline-none"
          >
            <option value="purchased">En stock</option>
            <option value="listed">En vente</option>
            <option value="sold">Vendu</option>
            <option value="returned">Retourne</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-tg-hint block mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notes personnelles..."
            rows={3}
            className="w-full bg-tg-secondary rounded-lg px-3 py-2.5 text-sm text-tg outline-none resize-none focus:ring-2 focus:ring-tg-button/30"
          />
        </div>
      </div>
    </div>
  );
}

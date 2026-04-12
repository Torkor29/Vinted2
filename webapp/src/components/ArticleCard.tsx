import { ExternalLink, Gem } from 'lucide-react'
import { type VintedItem, type Deal } from '../api/client'
import { formatPrice, timeAgo, truncate, getImageUrl } from '../utils/format'

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        openLink?: (url: string) => void
      }
    }
  }
}

interface ArticleCardProps {
  item: VintedItem | Deal
  showDeal?: boolean
}

function openExternal(url: string) {
  // In Telegram Mini App: use Telegram API to open externally (no page change)
  if (window.Telegram?.WebApp?.openLink) {
    window.Telegram.WebApp.openLink(url)
  } else {
    window.open(url, '_blank', 'noopener')
  }
}

export default function ArticleCard({ item, showDeal }: ArticleCardProps) {
  const imageUrl = getImageUrl(item)
  const price = typeof item.price === 'string' ? parseFloat(item.price) : (item.price || 0)
  const deal = item as Deal
  const hasDeal = showDeal && deal.discount_percent && deal.discount_percent > 0

  const handleOpen = () => {
    if (item.url) openExternal(item.url)
  }

  return (
    <div
      className="glass-card p-3 flex gap-3 animate-slide-up cursor-pointer active:scale-[0.98] transition-transform"
      onClick={handleOpen}
    >
      {/* Image */}
      <div className="w-[76px] h-[76px] rounded-xl overflow-hidden bg-bg-secondary shrink-0 relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-2xs">
            Photo
          </div>
        )}
        {hasDeal && (
          <div className="absolute top-1 left-1 bg-gold text-black text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
            <Gem size={9} />
            -{Math.round(deal.discount_percent!)}%
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <h3 className="text-sm font-semibold text-white leading-snug truncate">
            {truncate(item.title, 40)}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {item.brand_title && (
              <span className="text-2xs bg-accent/15 text-accent-light px-1.5 py-0.5 rounded font-medium">
                {item.brand_title}
              </span>
            )}
            {item.size_title && (
              <span className="text-2xs bg-bg-secondary text-gray-400 px-1.5 py-0.5 rounded font-medium">
                {item.size_title}
              </span>
            )}
            {item._query_name && (
              <span className="text-2xs text-gray-500">
                {item._query_name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-white">{formatPrice(price)}</span>
            {hasDeal && deal.market_price && (
              <span className="text-2xs text-gray-500 line-through">
                {formatPrice(deal.market_price)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xs text-gray-500">{timeAgo(item.created_at_ts || item._detected_at)}</span>
            {item.url && (
              <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
                <ExternalLink size={13} className="text-accent-light" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

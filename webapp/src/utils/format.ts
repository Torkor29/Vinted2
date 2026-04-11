export function formatPrice(price: string | number | undefined): string {
  if (price === undefined || price === null) return '0,00 \u20ac'
  const num = typeof price === 'string' ? parseFloat(price) : price
  if (isNaN(num)) return '0,00 \u20ac'
  return num.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' \u20ac'
}

export function formatPriceShort(price: number | undefined): string {
  if (!price) return '0 \u20ac'
  if (price >= 1000) return (price / 1000).toFixed(1).replace('.0', '') + 'k \u20ac'
  return Math.round(price) + ' \u20ac'
}

export function formatPercent(value: number | undefined): string {
  if (!value) return '0%'
  return (value > 0 ? '+' : '') + value.toFixed(1) + '%'
}

export function formatNumber(value: number | undefined): string {
  if (!value) return '0'
  return value.toLocaleString('fr-FR')
}

export function timeAgo(dateOrTs: string | number | undefined): string {
  if (!dateOrTs) return ''
  const date = typeof dateOrTs === 'number'
    ? new Date(dateOrTs * 1000)
    : new Date(dateOrTs)
  const now = Date.now()
  const diff = Math.floor((now - date.getTime()) / 1000)

  if (diff < 5) return '\u00e0 l\'instant'
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function truncate(str: string, max: number): string {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '\u2026' : str
}

export function getImageUrl(item: { photo?: any; photos?: any[] }): string {
  const photo = item.photo || item.photos?.[0]
  if (!photo) return ''
  const thumb = photo.thumbnails?.find((t: any) => t.type === 'thumb150')
    || photo.thumbnails?.find((t: any) => t.type === 'thumb310x430')
    || photo.thumbnails?.[0]
  return thumb?.url || photo.url || ''
}

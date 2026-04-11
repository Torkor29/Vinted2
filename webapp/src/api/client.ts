import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'https://vintedlba.duckdns.org'

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const key = import.meta.env.VITE_API_KEY || localStorage.getItem('api_key')
  if (key) {
    config.headers.Authorization = `Bearer ${key}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('api_key')
    }
    return Promise.reject(err)
  },
)

export interface BotStatus {
  running: boolean
  uptime?: number
  queries?: number
}

export interface CatalogData {
  genders: CatalogItem[]
  categories: CatalogCategory[]
  sizes: CatalogItem[]
  colors: CatalogColor[]
  conditions: CatalogItem[]
}

export interface CatalogItem {
  id: number
  title: string
}

export interface CatalogCategory {
  id: number
  title: string
  parent_id?: number
  children?: CatalogCategory[]
}

export interface CatalogColor {
  id: number
  title: string
  hex?: string
}

export interface Brand {
  id: number
  title: string
  slug?: string
  item_count?: number
}

export interface VintedQuery {
  search_text?: string
  catalog_ids?: number[]
  brand_ids?: number[]
  size_ids?: number[]
  status_ids?: number[]
  color_ids?: number[]
  price_from?: number
  price_to?: number
  gender?: string
  _name?: string
  _labels?: {
    catalogs?: string[]
    brands?: string[]
    sizes?: string[]
    colors?: string[]
    statuses?: string[]
  }
}

export interface VintedItem {
  id: number
  title: string
  price: string | number
  currency?: string
  brand_title?: string
  size_title?: string
  photo?: { url?: string; thumbnails?: { type: string; url: string }[] }
  photos?: { url?: string; thumbnails?: { type: string; url: string }[] }[]
  url: string
  created_at_ts?: number
  user?: { login?: string }
  status?: string
  is_favourite?: boolean
  _query_name?: string
  _detected_at?: string
}

export interface Deal extends VintedItem {
  market_price?: number
  discount_percent?: number
}

export interface Stats {
  total_items?: number
  total_deals?: number
  items_today?: number
  deals_today?: number
  invested?: number
  revenue?: number
  profit?: number
  roi?: number
  top_brands?: { name: string; count: number }[]
  timeline?: { date: string; profit: number }[]
}

export interface SessionInfo {
  active: number
  total: number
  healthy?: number
}

// Bot
export const getBotStatus = () => api.get<BotStatus>('/api/bot/status').then(r => r.data)
export const startBot = () => api.post('/api/bot/start').then(r => r.data)
export const stopBot = () => api.post('/api/bot/stop').then(r => r.data)

// Catalog — normalize backend fields (label → title)
const normItems = (arr: any[]): any[] =>
  (arr || []).map((item: any) => ({
    ...item,
    title: item.title || item.label || item.name || `#${item.id}`,
    children: item.children ? normItems(item.children) : undefined,
  }))

export const getCatalog = async (): Promise<CatalogData> => {
  const { data } = await api.get('/api/catalog')
  return {
    genders: normItems(data.genders || []),
    categories: normItems(data.categories || []),
    sizes: normItems(data.sizes || []),
    colors: (data.colors || []).map((c: any) => ({
      ...c,
      title: c.title || c.label || c.name || `#${c.id}`,
      hex: c.hex || c.code || undefined,
    })),
    conditions: normItems(data.conditions || []),
  }
}

// Brands — normalize 'label' → 'title'
export const searchBrands = async (q: string): Promise<Brand[]> => {
  const { data } = await api.get('/api/brands/search', { params: { q } })
  return (data || []).map((b: any) => ({
    ...b,
    title: b.title || b.label || b.name || `#${b.id}`,
  }))
}

// Queries (filters)
export const getQueries = () => api.get<VintedQuery[]>('/api/queries').then(r => r.data)
export const createQuery = (query: VintedQuery) => api.post('/api/queries', query).then(r => r.data)
export const deleteQuery = (index: number) => api.delete(`/api/queries/${index}`).then(r => r.data)

// Items
export const getItems = () => api.get<VintedItem[]>('/api/items').then(r => r.data)

// Deals
export const getTopDeals = () => api.get<Deal[]>('/api/deals/top').then(r => r.data)
export const getDealStats = () => api.get('/api/deals/stats').then(r => r.data)

// Stats
export const getStats = () => api.get<Stats>('/api/stats').then(r => r.data)
export const getSessions = () => api.get<SessionInfo>('/api/sessions').then(r => r.data)

// CRM
export const getInventory = () => api.get('/api/crm/inventory').then(r => r.data)
export const getCrmStats = () => api.get('/api/crm/stats').then(r => r.data)

export default api

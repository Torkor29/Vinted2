import { type ReactNode } from 'react'

interface KpiCardProps {
  icon: ReactNode
  label: string
  value: string
  sub?: string
  gradient?: string
}

export default function KpiCard({ icon, label, value, sub, gradient }: KpiCardProps) {
  return (
    <div className="glass-card p-3.5 flex flex-col gap-2 animate-scale-in">
      <div className="flex items-center gap-2">
        <div
          className={`w-8 h-8 rounded-10 flex items-center justify-center shrink-0 ${gradient || 'bg-accent/15'}`}
          style={{ borderRadius: 10 }}
        >
          {icon}
        </div>
        <span className="text-xs text-gray-400 font-medium leading-tight">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold tracking-tight text-white">{value}</span>
        {sub && <span className="text-xs text-gray-500">{sub}</span>}
      </div>
    </div>
  )
}

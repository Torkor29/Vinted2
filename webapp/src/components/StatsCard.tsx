interface Props {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export default function StatsCard({ label, value, subtitle, icon, trend }: Props) {
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-tg-hint';

  return (
    <div className="bg-tg-section rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-tg-hint">{label}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className={`text-xl font-bold ${trendColor}`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-tg-hint mt-0.5">{subtitle}</div>
      )}
    </div>
  );
}

interface Props {
  name: string;
  isActive: boolean;
  onClick?: () => void;
}

export default function FilterBadge({ name, isActive, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all
        ${isActive
          ? 'bg-tg-button text-tg-button'
          : 'bg-tg-secondary text-tg-hint'
        }
      `}
    >
      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400' : 'bg-gray-400'}`} />
      {name}
    </button>
  );
}

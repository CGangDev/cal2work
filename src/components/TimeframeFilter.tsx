interface Props {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}

export function TimeframeFilter({ start, end, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500 font-medium">From</span>
      <input
        type="date"
        value={start}
        onChange={(e) => onChange(e.target.value, end)}
        className="border border-gray-200 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
      <span className="text-gray-500 font-medium">to</span>
      <input
        type="date"
        value={end}
        onChange={(e) => onChange(start, e.target.value)}
        className="border border-gray-200 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
    </div>
  );
}

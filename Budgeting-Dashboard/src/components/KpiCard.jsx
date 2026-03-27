export default function KpiCard({ label, value, delta, deltaLabel, subLine, muted }) {
  const positive = delta > 0
  return (
    <div className="bg-[#181818] border border-[#66473B] rounded p-5">
      <p
        className="text-xs font-medium text-[#B6A596] uppercase tracking-widest"
        style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
      >
        {label}
      </p>
      <p
        className={`text-2xl font-bold mt-2 ${muted ? 'text-[#66473B]' : 'text-[#EBDCC4]'}`}
        style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
      >
        {value}
      </p>
      {subLine && (
        <p className="text-xs text-[#B6A596] mt-1" data-testid="kpi-subline">
          {subLine}
        </p>
      )}
      {delta !== undefined && (
        <p className={`text-xs mt-1 ${positive ? 'text-[#DC9F85]' : 'text-[#B6A596]'}`}>
          {positive ? '↑' : '↓'} {Math.abs(delta)}% {deltaLabel}
        </p>
      )}
    </div>
  )
}

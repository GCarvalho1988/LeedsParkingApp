export default function KpiCard({ label, value, delta, deltaLabel }) {
  const positive = delta > 0
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {delta !== undefined && (
        <p className={`text-sm mt-1 ${positive ? 'text-red-500' : 'text-green-600'}`}>
          {positive ? '↑' : '↓'} {Math.abs(delta)}% {deltaLabel}
        </p>
      )}
    </div>
  )
}

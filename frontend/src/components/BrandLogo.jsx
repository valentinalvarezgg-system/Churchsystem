import { useId } from 'react'

function BrandMark({
  variant = 'light',
  size = 40,
  className = '',
  style = {},
}) {
  const gradientId = useId().replace(/:/g, '')
  const shadowId = `${gradientId}-shadow`
  const isDark = variant === 'dark'
  const backgroundFill = isDark ? '#111624' : '#FFFFFF'
  const backgroundStroke = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(88, 96, 128, 0.08)'
  const shadowColor = isDark ? 'rgba(0, 0, 0, 0.42)' : 'rgba(130, 138, 164, 0.22)'
  const stopA = isDark ? '#8C72FF' : '#4931FF'
  const stopB = isDark ? '#4C66FF' : '#5A48FF'

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="58" y1="58" x2="198" y2="198" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={stopA} />
          <stop offset="100%" stopColor={stopB} />
        </linearGradient>
        <filter id={shadowId} x="0" y="0" width="256" height="256" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor={shadowColor} />
        </filter>
      </defs>

      <g filter={`url(#${shadowId})`}>
        <rect x="14" y="14" width="228" height="228" rx="54" fill={backgroundFill} stroke={backgroundStroke} />
      </g>

      <path
        d="M146 78H102C70 78 46 102 46 134C46 166 70 190 102 190H154"
        stroke={`url(#${gradientId})`}
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M114 134H158C190 134 214 158 214 190C214 222 190 246 158 246H116"
        transform="translate(0 -24)"
        stroke={`url(#${gradientId})`}
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function BrandLogo({
  variant = 'light',
  size = 40,
  wordmark = true,
  subtitle = '',
  title = 'Church System',
  textColor,
  subtitleColor,
  gap = 12,
  align = 'center',
  style = {},
  className = '',
}) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        gap,
        minWidth: 0,
        ...style,
      }}
    >
      <BrandMark variant={variant} size={size} />
      {wordmark && (
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: size >= 56 ? 26 : size >= 40 ? 18 : 16,
              lineHeight: 1.05,
              fontWeight: 800,
              color: textColor || 'var(--text)',
              letterSpacing: '-0.03em',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                marginTop: 4,
                fontSize: size >= 56 ? 13 : 11,
                lineHeight: 1.25,
                color: subtitleColor || 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export { BrandMark }

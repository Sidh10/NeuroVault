import React from 'react';

export function TrustRing({ score }) {
  const size = 180;
  const strokeWidth = 12;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  
  const offset = circumference - (score / 100) * circumference;
  
  let color = "var(--success)";
  if (score < 40) {
    color = "var(--danger)";
  } else if (score < 80) {
    color = "var(--warning)";
  }

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--surface)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.4s ease' }}
        />
      </svg>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 48, fontWeight: 500, color: 'var(--text-primary)', zIndex: 1 }}>
        {score}
      </div>
    </div>
  );
}

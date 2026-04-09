import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function ShapBreakdown({ shapFeatures }) {
  // 1. Convert { "Feature Name": value } slightly formatting strings occasionally
  // 2. Sort by absolute magnitude to highlight biggest drivers (positive or negative)
  // 3. Take top 5
  const data = Object.entries(shapFeatures || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 5);

  // If no data, show placeholder
  if (data.length === 0) {
    return (
      <div style={{ width: '100%', height: 250, background: 'var(--surface)', borderRadius: 8, padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Awaiting telemetry...</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 250, background: 'var(--surface)', borderRadius: 8, padding: '1rem' }}>
      <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', fontFamily: 'var(--font-sans)' }}>Top Behavioral Drivers</h3>
      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis 
                dataKey="name" 
                type="category" 
                width={120} 
                tick={{ fontSize: 11, fill: 'var(--text-primary)' }} 
                axisLine={false} 
                tickLine={false} 
            />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              contentStyle={{ background: 'var(--background)', border: '1px solid #2a2a35', borderRadius: 4, fontSize: 12 }}
              formatter={(val) => [val.toFixed(3), 'Deviation']}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12} isAnimationActive={false}>
              {data.map((entry, index) => (
                // Negative values drop the score (anomalous), positive support it (normal)
                <Cell key={`cell-${index}`} fill={entry.value < 0 ? 'var(--danger)' : 'var(--primary)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

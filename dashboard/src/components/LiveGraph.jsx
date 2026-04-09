import React, { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export function LiveGraph({ currentScore }) {
  // Rolling 60-point window (5 minutes if updated every 5s)
  const [data, setData] = useState([]);
  const hasStarted = useRef(false);

  useEffect(() => {
    // initialize on first mount with current score
    if (!hasStarted.current) {
        setData(Array.from({ length: 60 }, (_, i) => ({ time: i, score: currentScore })));
        hasStarted.current = true;
        return;
    }
    
    setData((prev) => {
      const nextTime = prev.length > 0 ? prev[prev.length - 1].time + 1 : 0;
      return [...prev.slice(1), { time: nextTime, score: currentScore }];
    });
  }, [currentScore]);

  return (
    <div style={{ width: '100%', height: 250, background: 'var(--surface)', borderRadius: 8, padding: '1rem' }}>
      <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', fontFamily: 'var(--font-sans)' }}>Live Trajectory (5 Min)</h3>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis domain={[0, 100]} stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ background: 'var(--background)', border: '1px solid #2a2a35', borderRadius: 4 }}
              itemStyle={{ color: 'var(--primary)' }}
              labelStyle={{ display: 'none' }}
              formatter={(value) => [`${value}`, 'Trust Score']}
            />
            <ReferenceLine y={85} stroke="var(--text-secondary)" strokeDasharray="3 3" />
            <Line 
              type="monotone" 
              dataKey="score" 
              stroke="var(--primary)" 
              strokeWidth={2} 
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

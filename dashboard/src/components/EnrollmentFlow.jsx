import React, { useState, useEffect } from 'react';

export function EnrollmentFlow({ sessionId, collectorRef, onEnrollSuccess, onDemoSuccess }) {
  const [elapsed, setElapsed] = useState(0);
  const [stats, setStats] = useState({ mouse_count: 0, key_count: 0, scroll_count: 0 });
  const [isEnrolling, setIsEnrolling] = useState(false);
  const totalTime = 180; // 3 minutes

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(prev => {
        if (prev < totalTime) return prev + 1;
        return prev;
      });
      
      if (collectorRef && collectorRef.current) {
        setStats(collectorRef.current.getStats());
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [collectorRef]);

  const handleEnroll = async () => {
    setIsEnrolling(true);
    try {
      const res = await fetch(`http://localhost:8000/enroll/${sessionId}`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'enrolled') {
        onEnrollSuccess();
      } else {
        alert("Enrollment failed: " + JSON.stringify(data));
      }
    } catch (e) {
      alert("Error enrolling: " + e.message);
    }
    setIsEnrolling(false);
  };

  const loadDemo = async () => {
    setIsEnrolling(true);
    try {
      const res = await fetch(`http://localhost:8000/demo/load`, { method: 'POST' });
      await res.json();
      if (onDemoSuccess) onDemoSuccess();
    } catch (e) {
      alert("Error loading demo: " + e.message);
    }
    setIsEnrolling(false);
  };

  const progressPercent = Math.min((elapsed / totalTime) * 100, 100);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{ width: '100%', maxWidth: 600, background: 'var(--surface)', borderRadius: 12, padding: '2.5rem', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--primary)', marginBottom: '1rem', fontSize: '1.5rem' }}>NeuroVault Enrollment</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>
          Please use the application normally. Your baseline motor patterns are being collected.
        </p>

        {/* Progress bar */}
        <div style={{ width: '100%', height: 8, background: 'var(--background)', borderRadius: 4, overflow: 'hidden', marginBottom: '1rem' }}>
          <div style={{ 
            height: '100%', 
            width: `${progressPercent}%`, 
            background: 'var(--success)', 
            transition: 'width 1s linear' 
          }} />
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '3rem', textAlign: 'right' }}>
          {elapsed}s / {totalTime}s
        </div>

        {/* Counters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', color: 'var(--text-primary)' }}>{stats.mouse_count}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Mouse events</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', color: 'var(--text-primary)' }}>{stats.key_count}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Keystrokes</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', color: 'var(--text-primary)' }}>{stats.scroll_count}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Scroll sequences</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button 
            onClick={handleEnroll} 
            disabled={isEnrolling}
            style={{
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500
            }}
          >
            {isEnrolling ? 'Processing...' : 'Complete Enrollment'}
          </button>
          
          <button 
            onClick={loadDemo}
            disabled={isEnrolling}
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--text-secondary)',
              padding: '0.75rem 1.5rem',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)'
            }}
          >
            Skip (Demo Mode)
          </button>
        </div>
      </div>
    </div>
  );
}

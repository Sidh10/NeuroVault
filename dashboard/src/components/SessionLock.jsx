import React, { useState, useEffect } from 'react';

export function SessionLock({ topAnomaly }) {
  const [timestamp, setTimestamp] = useState('');

  useEffect(() => {
    setTimestamp(new Date().toLocaleTimeString());
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--danger)',
      color: '#FFFFFF',
      textAlign: 'center',
      padding: '2rem',
      animation: 'fadeIn 200ms ease-in'
    }}>
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1.5rem' }}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: '32px', fontWeight: 600, marginBottom: '1rem', letterSpacing: '0.05em' }}>
        MOTOR MISMATCH DETECTED
      </h1>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '18px', marginBottom: '2rem', opacity: 0.9 }}>
        {topAnomaly}
      </p>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', opacity: 0.8 }}>
        Session locked at {timestamp}
      </div>
    </div>
  );
}

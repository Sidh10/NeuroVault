import React, { useState } from 'react';
import { useNeuroVault } from './hooks/useNeuroVault';
import { EnrollmentFlow } from './components/EnrollmentFlow';
import { SessionLock } from './components/SessionLock';
import { TrustRing } from './components/TrustRing';
import { LiveGraph } from './components/LiveGraph';
import { ShapBreakdown } from './components/ShapBreakdown';

function App() {
  const [sessionId, setSessionId] = useState(() => 'user-session-' + Date.now());
  const [isEnrolled, setIsEnrolled] = useState(false);
  
  const { 
    trustScore, 
    shapFeatures, 
    topAnomaly, 
    locked, 
    connectionState, 
    collectorRef 
  } = useNeuroVault(sessionId);

  if (locked) {
    return <SessionLock topAnomaly={topAnomaly} />;
  }

  if (!isEnrolled) {
    return (
      <EnrollmentFlow 
        sessionId={sessionId} 
        collectorRef={collectorRef}
        onEnrollSuccess={() => setIsEnrolled(true)}
        onDemoSuccess={() => {
            setSessionId('demo');
            setIsEnrolled(true);
        }}
      />
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: 'var(--primary)', fontSize: '1.5rem', marginBottom: '0.25rem' }}>NeuroVault Console</h1>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Session: {sessionId}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ 
            width: 8, height: 8, borderRadius: '50%', 
            background: connectionState === 'open' ? 'var(--success)' : 'var(--warning)' 
          }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
            {connectionState.toUpperCase()}
          </span>
        </div>
      </header>

      <main>
        {/* Top Split: Ring & Graph */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h2 style={{ alignSelf: 'flex-start', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '2rem' }}>Active Confidence</h2>
            <TrustRing score={trustScore} />
          </div>
          
          <LiveGraph currentScore={trustScore} />
        </div>

        {/* Bottom Split: SHAP Breakdown & Logs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
          <ShapBreakdown shapFeatures={shapFeatures} />
          
          <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem' }}>
            <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', fontFamily: 'var(--font-sans)' }}>Engine Telemetry</h3>
            
            <div style={{ padding: '1rem', background: 'var(--background)', borderRadius: 6, marginBottom: '1rem' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>Latest Inference Observation</div>
              <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                {topAnomaly || 'Normal operations'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', background: 'var(--background)', borderRadius: 6 }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>Update Rate</div>
                <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>5000ms</div>
              </div>
              <div style={{ padding: '0.75rem', background: 'var(--background)', borderRadius: 6 }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>Model</div>
                <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>iForest (SHAP)</div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

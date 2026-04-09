/**
 * Phase 2 — Test 5: React WebSocket Component
 * Confirms: React renders, connects to WS, displays received messages
 */
import { useState, useEffect, useRef } from 'react';

function TestWebSocket() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('disconnected');
  const [testResult, setTestResult] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    setStatus('connecting');

    const ws = new WebSocket('ws://localhost:8000/ws/test');
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      setMessages(prev => [...prev, { type: 'system', text: 'Connected to ws://localhost:8000/ws/test' }]);

      // Send a test telemetry batch
      const testBatch = {
        user_id: "react_test_user",
        session_id: "b4f2d0e8-5c3e-4a9b-8d2f-6e4c7b3a9f5d",
        batch_seq: 0,
        timestamp: Date.now(),
        events: [
          { type: "mousemove", x: 100, y: 200, dx: 1.5, dy: -0.8, t: Date.now() },
          { type: "keydown", key: "x", t: Date.now(), flight_time: 65.2, dwell_time: null },
        ]
      };

      ws.send(JSON.stringify(testBatch));
      setMessages(prev => [...prev, {
        type: 'sent',
        text: `Sent batch with ${testBatch.events.length} events`
      }]);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages(prev => [...prev, {
        type: 'received',
        text: `Echo: user_id=${data.user_id}, events=${data.events.length}`
      }]);

      // Verify integrity
      if (data.user_id === "react_test_user" && data.events.length === 2) {
        setTestResult('PASS');
        setMessages(prev => [...prev, {
          type: 'result',
          text: 'TEST 5: PASS — React + WebSocket round-trip verified'
        }]);
      } else {
        setTestResult('FAIL');
        setMessages(prev => [...prev, {
          type: 'result',
          text: 'TEST 5: FAIL — data mismatch'
        }]);
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setTestResult('FAIL');
      setMessages(prev => [...prev, {
        type: 'error',
        text: 'WebSocket ERROR — is test_websocket.py running?'
      }]);
    };

    ws.onclose = () => {
      setStatus('closed');
    };

    return () => {
      ws.close();
    };
  }, []);

  const colors = {
    system: '#8888A0',
    sent: '#7F77DD',
    received: '#1D9E75',
    error: '#E24B4A',
    result: testResult === 'PASS' ? '#1D9E75' : '#E24B4A',
  };

  return (
    <div style={{
      background: '#0A0A0F',
      color: '#F0F0F5',
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: '2rem',
      minHeight: '100vh',
    }}>
      <h1 style={{ color: '#7F77DD', fontWeight: 500 }}>
        Phase 2 — Test 5: React WebSocket Component
      </h1>

      <div style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '13px',
        fontFamily: "'JetBrains Mono', monospace",
        background: status === 'connected' ? '#1D9E7520' : status === 'error' ? '#E24B4A20' : '#8888A020',
        color: status === 'connected' ? '#1D9E75' : status === 'error' ? '#E24B4A' : '#8888A0',
        marginBottom: '1rem',
      }}>
        ● {status.toUpperCase()}
      </div>

      {testResult && (
        <div id="test-result" style={{
          padding: '1rem',
          borderRadius: '8px',
          marginTop: '1rem',
          background: testResult === 'PASS' ? '#1D9E7515' : '#E24B4A15',
          border: `1px solid ${testResult === 'PASS' ? '#1D9E75' : '#E24B4A'}`,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '18px',
          color: testResult === 'PASS' ? '#1D9E75' : '#E24B4A',
        }}>
          TEST 5: {testResult}
        </div>
      )}

      <div style={{
        background: '#13131A',
        padding: '1rem',
        borderRadius: '8px',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '13px',
        marginTop: '1rem',
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ color: colors[msg.type] || '#F0F0F5', marginBottom: '4px' }}>
            [{msg.type.toUpperCase()}] {msg.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export default TestWebSocket;

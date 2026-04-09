import { useState, useEffect, useRef } from 'react';

export function useNeuroVault(sessionId) {
  const [trustScore, setTrustScore] = useState(100);
  const [shapFeatures, setShapFeatures] = useState({});
  const [topAnomaly, setTopAnomaly] = useState("Authenticating...");
  const [locked, setLocked] = useState(false);
  const [connectionState, setConnectionState] = useState("disconnected");
  
  const collectorRef = useRef(null);
  const trustWsRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;

    // 1. Ensure NeuroCollector script is loaded
    const loadCollector = async () => {
      if (typeof NeuroCollector === 'undefined') {
        const script = document.createElement("script");
        script.src = "http://localhost:8000/collector/collector.js";
        script.async = true;
        document.body.appendChild(script);
        await new Promise(resolve => {
            script.onload = resolve;
            script.onerror = resolve; // Continue even if it errors to try gracefully
        });
      }
      
      if (typeof NeuroCollector !== 'undefined') {
        const collector = new NeuroCollector(`ws://localhost:8000/ws/collect/${sessionId}`);
        collector.setSessionId(sessionId);
        collector.onConnectionChange = (state) => {
          setConnectionState(state);
        };
        collector.start();
        collectorRef.current = collector;
      } else {
        setConnectionState("error_missing_script");
      }
    };
    
    loadCollector();

    // 2. Initialize Trust Score listener
    const connectTrust = () => {
        const ws = new WebSocket(`ws://localhost:8000/ws/trust/${sessionId}`);
        
        ws.onopen = () => {
            console.log("Trust connection established");
        }
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.trust_score !== undefined) setTrustScore(data.trust_score);
                if (data.shap_features) setShapFeatures(data.shap_features);
                if (data.top_anomaly) setTopAnomaly(data.top_anomaly);
                if (data.locked !== undefined) setLocked(data.locked);
            } catch (e) {
                console.error("Error parsing trust data", e);
            }
        };

        ws.onclose = () => {
            console.log("Trust connection closed, reconnecting...");
            // simple reconnection
            setTimeout(() => {
              if (trustWsRef.current !== null) connectTrust();
            }, 2000);
        };
        
        trustWsRef.current = ws;
    };

    connectTrust();

    return () => {
      if (collectorRef.current) {
        collectorRef.current.stop();
      }
      if (trustWsRef.current) {
        const prevWs = trustWsRef.current;
        trustWsRef.current = null; // flag to prevent reconnect loop
        prevWs.onclose = null; 
        prevWs.close();
      }
    };
  }, [sessionId]);

  return { trustScore, shapFeatures, topAnomaly, locked, connectionState, collectorRef };
}

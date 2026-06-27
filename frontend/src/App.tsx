import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import fpPromise from '@fingerprintjs/fingerprintjs';

// Fix for broken default Leaflet markers in Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Generate a random session ID for temporary UI stuff
let SESSION_ID = localStorage.getItem('protest_session');
if (!SESSION_ID) {
  SESSION_ID = Math.random().toString(36).substring(2, 15);
  localStorage.setItem('protest_session', SESSION_ID);
}

function App() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [status, setStatus] = useState<'idle' | 'locating' | 'submitting' | 'submitted' | 'queued' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [queueCount, setQueueCount] = useState(0);
  
  // Dual-View States
  const [viewMode, setViewMode] = useState<'strict' | 'scientific'>('strict');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [stats, setStats] = useState({ total_pings: 0, area_sqm: 0, min: 0, max: 0 });
  
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Initialize FingerprintJS
  useEffect(() => {
    const initFingerprint = async () => {
      const fp = await fpPromise.load();
      const result = await fp.get();
      setDeviceId(result.visitorId);
    };
    initFingerprint();
  }, []);

  // Fetch live stats from the database
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/stats`);
        const data = await res.json();
        if (res.ok) {
          setStats({
            total_pings: data.total_pings || 0,
            area_sqm: data.area_sqm || 0,
            min: data.estimate_min || 0,
            max: data.estimate_max || 0
          });
        }
      } catch (err) {
        console.error("Failed to fetch live stats", err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000); // Poll every 5 seconds
    
    updateQueueCount();
    const syncInterval = setInterval(syncQueue, 10000); // Try to sync every 10 seconds
    
    return () => {
      clearInterval(interval);
      clearInterval(syncInterval);
    };
  }, []);

  const updateQueueCount = () => {
    const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
    setQueueCount(queue.length);
  };

  const syncQueue = async () => {
    if (!navigator.onLine) return;
    
    const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
    if (queue.length === 0) return;

    let remainingQueue = [...queue];

    for (const item of queue) {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });

        if (response.ok) {
          remainingQueue = remainingQueue.filter((qItem) => qItem.timestamp !== item.timestamp);
        }
      } catch (err) {
        console.error("Failed to sync item", err);
        break; 
      }
    }

    localStorage.setItem('offline_queue', JSON.stringify(remainingQueue));
    setQueueCount(remainingQueue.length);
  };

  const handleCheckIn = () => {
    if (!deviceId) {
      setErrorMessage("Initializing secure connection, please wait...");
      return;
    }
    
    setStatus('locating');
    setErrorMessage('');

    if (!navigator.geolocation) {
      setStatus('error');
      setErrorMessage('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setPosition([latitude, longitude]);
        setStatus('submitting');

        const payload = {
          lat: latitude,
          lng: longitude,
          accuracy,
          timestamp: new Date().toISOString(),
          sessionId: SESSION_ID,
          deviceId: deviceId, // Secure hardware fingerprint
        };

        if (!navigator.onLine) {
          const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
          queue.push(payload);
          localStorage.setItem('offline_queue', JSON.stringify(queue));
          updateQueueCount();
          setStatus('queued');
        } else {
          try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/submit`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            if (!response.ok) {
              const resData = await response.json();
              throw new Error(resData.error || 'Failed to submit');
            }
            setStatus('submitted');
            localStorage.setItem('has_submitted', 'true');
          } catch (err: any) {
            const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
            queue.push(payload);
            localStorage.setItem('offline_queue', JSON.stringify(queue));
            updateQueueCount();
            setStatus('queued');
          }
        }
      },
      (err) => {
        setStatus('error');
        setErrorMessage(err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // If already submitted in a previous session, set initial status
  useEffect(() => {
    if (localStorage.getItem('has_submitted') === 'true' && status === 'idle') {
      setStatus('submitted');
    }
  }, [status]);

  return (
    <div className="relative h-[100dvh] w-full flex flex-col font-sans text-slate-100 overflow-hidden">
      
      {/* Map Background */}
      <div className="absolute inset-0 z-0">
        <MapContainer 
          center={position || [44.8125, 20.4612]} // Default Belgrade
          zoom={14} 
          zoomControl={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {position && (
            <>
              <Circle center={position} radius={50} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2 }} />
              <Marker position={position}>
                <Popup>You are here</Popup>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>

      {/* Top Bar - Dual View Stats */}
      <div className="relative z-10 w-full p-6 bg-gradient-to-b from-slate-900 to-transparent">
        <h1 className="text-2xl font-bold tracking-tight text-white mb-4">OpenCrowd</h1>
        
        {/* View Toggle */}
        <div className="flex bg-slate-800/80 backdrop-blur-md rounded-full p-1 mb-4 border border-slate-700">
          <button 
            onClick={() => setViewMode('strict')}
            className={`flex-1 py-2 text-sm font-bold rounded-full transition-all ${viewMode === 'strict' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Strict Count
          </button>
          <button 
            onClick={() => setViewMode('scientific')}
            className={`flex-1 py-2 text-sm font-bold rounded-full transition-all ${viewMode === 'scientific' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Scientific Estimate
          </button>
        </div>

        {viewMode === 'strict' ? (
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-6 border border-blue-900/50 shadow-2xl">
            <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Verified Participants</p>
            <div className="text-5xl font-black text-white tracking-tighter">
              {stats.total_pings.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-2 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></span>
              1 Device = 1 Vote (Incognito Proof)
            </p>
          </div>
        ) : (
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-5 border border-purple-900/50 shadow-2xl">
            <div className="flex justify-between items-start mb-2">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Jacobs' Crowd Estimate</p>
              <button onClick={() => setShowInfoModal(true)} className="text-purple-400 hover:text-purple-300 text-xs font-bold underline">
                How does this work?
              </button>
            </div>
            
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-black text-white">{stats.min.toLocaleString()}</span>
              <span className="text-sm font-bold text-slate-500">to</span>
              <span className="text-3xl font-black text-white">{stats.max.toLocaleString()}</span>
            </div>
            
            <div className="pt-3 border-t border-slate-700/50 flex justify-between items-center">
              <p className="text-xs text-slate-400">Total Footprint Area:</p>
              <p className="text-sm font-bold text-slate-200">{stats.area_sqm.toLocaleString()} m²</p>
            </div>
          </div>
        )}
      </div>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-3">The Science of Counting</h2>
            <p className="text-sm text-slate-300 mb-3 leading-relaxed">
              When cellular networks jam at large protests, not everyone can check in. To counter this, we use <strong>Area Footprint Mapping</strong>.
            </p>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              Our PostgreSQL database groups nearby GPS pings into a massive spatial polygon to calculate the exact physical square meterage of the crowd. We then apply <strong>Jacobs' Crowd Formula</strong> (1 to 4 people per m²) to extrapolate the true size of the gathering.
            </p>
            <button 
              onClick={() => setShowInfoModal(false)}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom Action Bar */}
      <div className="relative z-10 p-6 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent flex flex-col items-center pb-[env(safe-area-inset-bottom)]">
        
        {queueCount > 0 && (
          <div className="mb-4 bg-amber-500/20 border border-amber-500/50 text-amber-200 px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm">
            {queueCount} signal(s) waiting for connection...
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-xl text-sm w-full max-w-sm text-center backdrop-blur-sm">
            {errorMessage}
          </div>
        )}

        {status === 'idle' && (
          <button 
            onClick={handleCheckIn}
            className="w-full max-w-sm bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-5 px-8 rounded-2xl shadow-[0_0_40px_rgba(37,99,235,0.4)] transition-all transform hover:scale-[1.02] active:scale-[0.98] text-xl"
          >
            I'M HERE
          </button>
        )}

        {status === 'locating' && (
          <div className="w-full max-w-sm bg-slate-800 text-white font-bold py-5 px-8 rounded-2xl text-center text-xl animate-pulse">
            Acquiring GPS Signal...
          </div>
        )}

        {status === 'submitting' && (
          <div className="w-full max-w-sm bg-slate-800 text-white font-bold py-5 px-8 rounded-2xl text-center text-xl animate-pulse">
            Verifying Device...
          </div>
        )}

        {status === 'submitted' && (
          <div className="w-full text-center flex flex-col items-center gap-2 mt-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-2xl border border-emerald-500/30">
              ✓
            </div>
            <p className="text-emerald-400 font-bold text-lg">You've successfully checked in</p>
            <p className="text-slate-400 text-sm">Your location is expanding the crowd footprint.</p>
          </div>
        )}

        {status === 'queued' && (
          <div className="w-full max-w-sm py-4 px-8 bg-yellow-900/80 text-yellow-300 font-bold rounded-full text-center shadow-[0_0_20px_rgba(234,179,8,0.2)] border border-yellow-700/50 flex flex-col items-center gap-1">
            <span className="text-yellow-400 text-lg">Signal Saved!</span>
            <span className="text-xs font-medium text-yellow-500/80">No internet. Will sync when connected.</span>
          </div>
        )}

        {status === 'error' && (
          <div className="w-full max-w-sm p-4 bg-red-900/90 text-red-200 rounded-2xl text-center shadow-lg border border-red-700">
            <p className="font-bold mb-1">Failed to get location</p>
            <p className="text-sm opacity-80 mb-3">{errorMessage}</p>
            <button 
              onClick={() => setStatus('idle')}
              className="py-2 px-6 bg-red-800 hover:bg-red-700 rounded-full font-semibold text-sm transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

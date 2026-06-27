import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Generate a random session ID on first load to prevent rapid double counting from same device
let SESSION_ID = localStorage.getItem('protest_session');
if (!SESSION_ID) {
  SESSION_ID = Math.random().toString(36).substring(2, 15);
  localStorage.setItem('protest_session', SESSION_ID);
}

function App() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'locating' | 'submitted' | 'queued' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [queueCount, setQueueCount] = useState(0);
  
  // Dummy stats for MVP UI
  const [stats, setStats] = useState({ area: 0, min: 0, max: 0 });

  // Fetch live stats from the database
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/stats`);
        const data = await res.json();
        if (res.ok) {
          setStats({
            area: data.area_sqm || 0,
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
    const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    setQueueCount(queue.length);
  };

  const syncQueue = async () => {
    if (!navigator.onLine) return;

    const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    if (queue.length === 0) return;

    const remainingQueue = [];

    for (const item of queue) {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });

        if (!response.ok) {
          // If 400 bad request (e.g. too old), we drop it. If 500 or network error, keep in queue.
          if (response.status >= 500 || response.status === 429) {
            remainingQueue.push(item);
          }
        }
      } catch (err) {
        // Network error, keep in queue
        remainingQueue.push(item);
      }
    }

    localStorage.setItem('sync_queue', JSON.stringify(remainingQueue));
    updateQueueCount();
  };

  const saveToQueue = (lat: number, lng: number, accuracy: number) => {
    const item = {
      lat,
      lng,
      accuracy,
      timestamp: new Date().toISOString(),
      sessionId: SESSION_ID,
    };

    const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    queue.push(item);
    localStorage.setItem('sync_queue', JSON.stringify(queue));
    updateQueueCount();
    syncQueue(); // Try immediately
  };

  const handleImHere = () => {
    setStatus('locating');
    
    if (!navigator.geolocation) {
      setStatus('error');
      setErrorMessage('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setPosition([latitude, longitude]);
        setAccuracy(accuracy);
        
        saveToQueue(latitude, longitude, accuracy);
        
        if (navigator.onLine) {
           setStatus('submitted');
        } else {
           setStatus('queued');
        }
        
        setTimeout(() => setStatus('idle'), 5000); // Reset UI after 5 seconds
      },
      (err) => {
        setStatus('error');
        setErrorMessage(err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="relative h-[100dvh] w-full flex flex-col font-sans text-slate-100 overflow-hidden">
      
      {/* Map Background */}
      <div className="absolute inset-0 z-0">
        <MapContainer 
          center={[44.8125, 20.4612]} // Belgrade coordinates
          zoom={14} 
          zoomControl={false}
          className="h-full w-full"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
          />
          {position && (
            <>
              <Marker position={position}>
                <Popup>You are here!</Popup>
              </Marker>
              <Circle center={position} radius={accuracy || 10} pathOptions={{ color: 'blue', fillColor: 'blue' }} />
            </>
          )}
        </MapContainer>
      </div>

      {/* Stats Overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-slate-900/90 to-transparent pointer-events-none">
        <div className="max-w-md mx-auto text-center space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">Live Crowd Estimate</h1>
          <div className="flex justify-center items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-400 drop-shadow-lg">{stats.min.toLocaleString()}</span>
            <span className="text-slate-300">to</span>
            <span className="text-3xl font-black text-emerald-400 drop-shadow-lg">{stats.max.toLocaleString()}</span>
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mt-1">
            Proven footprint: {stats.area.toLocaleString()} m²
          </p>
        </div>
      </div>

      {/* Queue indicator */}
      {queueCount > 0 && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-10 px-3 py-1 bg-yellow-600/90 text-yellow-100 text-xs font-bold rounded-full shadow-lg">
          {queueCount} check-in(s) waiting for internet...
        </div>
      )}

      {/* Action Bar (Bottom) */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-6 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent flex flex-col items-center">
        {status === 'idle' && (
          <button 
            onClick={handleImHere}
            className="w-full max-w-sm py-4 px-8 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all transform active:scale-95 text-lg"
          >
            I'M HERE (Count Me)
          </button>
        )}

        {status === 'locating' && (
          <div className="w-full max-w-sm py-4 px-8 bg-slate-800 text-slate-300 font-semibold rounded-full text-center flex items-center justify-center gap-3 shadow-lg border border-slate-700">
            <div className="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
            Acquiring GPS Signal...
          </div>
        )}

        {status === 'submitted' && (
          <div className="w-full max-w-sm py-4 px-8 bg-emerald-900/80 text-emerald-300 font-bold rounded-full text-center shadow-[0_0_20px_rgba(16,185,129,0.2)] border border-emerald-700/50 flex flex-col items-center gap-1">
            <span className="text-emerald-400 text-lg">✓ Verified</span>
            <span className="text-xs font-medium text-emerald-500/80">You've expanded the crowd footprint.</span>
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

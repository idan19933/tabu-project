import { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

// Fix Leaflet default marker icon issue in bundlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface ParcelGeo {
  center: [number, number];
  polygon?: [number, number][];
  gush: string;
  chelka: string;
  source?: string;
  method?: string;
}

interface BuildingMapProps {
  gush: string;
  chelka: string;
  address?: string;
  city?: string;
}

function FitBounds({ polygon, center }: { polygon?: [number, number][]; center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (polygon && polygon.length > 2) {
      const bounds = L.latLngBounds(polygon.map(([lat, lng]) => [lat, lng] as L.LatLngTuple));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 19 });
    } else {
      map.setView(center, 18);
    }
  }, [map, polygon, center]);
  return null;
}

export default function BuildingMap({ gush, chelka, address, city }: BuildingMapProps) {
  const [data, setData] = useState<ParcelGeo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocation = useCallback(() => {
    if (!gush || !chelka) {
      setLoading(false);
      setError('חסר גוש/חלקה');
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (address) params.set('address', address);
    if (city) params.set('city', city);
    const qs = params.toString();

    fetch(`/api/geo/parcel/${encodeURIComponent(gush)}/${encodeURIComponent(chelka)}${qs ? '?' + qs : ''}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((geo) => {
        setData(geo);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [gush, chelka, address, city]);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  if (loading) {
    return (
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 flex items-center justify-center gap-2">
        <Loader2 size={18} className="animate-spin text-blue-500" />
        <span className="text-sm text-slate-500">טוען מפת חלקה...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 flex items-center justify-center gap-2">
        <AlertTriangle size={18} className="text-amber-500" />
        <span className="text-sm text-slate-500">
          {error || 'לא ניתן לטעון מפה'}
        </span>
      </div>
    );
  }

  const center: [number, number] = data.center;
  const polygon: [number, number][] | undefined = data.polygon;
  const isLowConfidence = data.method === 'nominatim_city';

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 flex items-center gap-2">
        <MapPin size={16} className="text-white" />
        <span className="text-sm font-medium text-white">
          מפת חלקה — גוש {gush} חלקה {chelka}
        </span>
        {address && (
          <span className="text-xs text-blue-200 mr-auto">{address}</span>
        )}
      </div>

      {isLowConfidence && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2 text-right" dir="rtl">
          <AlertTriangle size={14} className="text-yellow-600 shrink-0" />
          <span className="text-xs text-yellow-800">
            לא הצלחנו לאתר את המיקום המדויק של החלקה. המפה מציגה את מרכז העיר בלבד.
          </span>
          <button
            onClick={fetchLocation}
            className="mr-auto flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 shrink-0"
          >
            <RefreshCw size={12} />
            נסה שוב
          </button>
        </div>
      )}

      <div style={{ height: 350 }}>
        <MapContainer
          center={center}
          zoom={18}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
            opacity={0.6}
          />

          {polygon && polygon.length > 2 && (
            <Polygon
              positions={polygon}
              pathOptions={{
                color: '#2563eb',
                weight: 3,
                fillColor: '#3b82f6',
                fillOpacity: 0.15,
                dashArray: '8, 4',
              }}
            />
          )}

          <Marker position={center}>
            <Popup>
              <div className="text-right" dir="rtl">
                <strong>גוש {gush} חלקה {chelka}</strong>
                {address && <p className="text-xs mt-1">{address}</p>}
              </div>
            </Popup>
          </Marker>

          <FitBounds polygon={polygon} center={center} />
        </MapContainer>
      </div>
    </div>
  );
}

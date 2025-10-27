import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Map as MapIcon, Satellite, Navigation, Layers, Route, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';

// Fix per i marker di Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

const MapView = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [mapLayer, setMapLayer] = useState<'streets' | 'satellite'>('streets');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isNavigationMode, setIsNavigationMode] = useState(false);
  const [startPoint, setStartPoint] = useState('');
  const [endPoint, setEndPoint] = useState('');
  const markersRef = useRef<L.Marker[]>([]);
  const routingControlRef = useRef<L.Routing.Control | null>(null);
  const layersRef = useRef<{
    streets: L.TileLayer;
    satellite: L.TileLayer;
  } | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Inizializza la mappa
    map.current = L.map(mapContainer.current, {
      center: [45, 12],
      zoom: 6,
      zoomControl: false,
    });

    // Layer stradale (OpenStreetMap)
    const streetsLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    });

    // Layer satellitare (Esri)
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© <a href="https://www.esri.com/">Esri</a>',
      maxZoom: 19,
    });

    layersRef.current = {
      streets: streetsLayer,
      satellite: satelliteLayer,
    };

    // Aggiungi il layer iniziale
    streetsLayer.addTo(map.current);

    // Aggiungi controllo zoom personalizzato
    L.control.zoom({ position: 'topright' }).addTo(map.current);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current || !layersRef.current) return;

    // Rimuovi tutti i layer
    map.current.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.current?.removeLayer(layer);
      }
    });

    // Aggiungi il layer selezionato
    if (mapLayer === 'streets') {
      layersRef.current.streets.addTo(map.current);
    } else {
      layersRef.current.satellite.addTo(map.current);
    }
  }, [mapLayer]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      // Usa Nominatim (OpenStreetMap) per la geocodifica
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      
      if (!response.ok) throw new Error('Ricerca fallita');
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const latNum = parseFloat(lat);
        const lonNum = parseFloat(lon);
        
        // Rimuovi marker precedenti
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];
        
        // Aggiungi nuovo marker
        const marker = L.marker([latNum, lonNum])
          .addTo(map.current!)
          .bindPopup(`<strong>${display_name}</strong>`)
          .openPopup();
        
        markersRef.current.push(marker);
        
        // Centra la mappa
        map.current?.setView([latNum, lonNum], 14, {
          animate: true,
          duration: 1.5,
        });
        
        toast.success('Luogo trovato!', {
          description: display_name,
        });
      } else {
        toast.error('Nessun risultato trovato');
      }
    } catch (error) {
      console.error('Errore nella ricerca:', error);
      toast.error('Errore durante la ricerca');
    } finally {
      setIsSearching(false);
    }
  };

  const getUserLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Centra la mappa
          map.current?.setView([latitude, longitude], 14, {
            animate: true,
            duration: 1.5,
          });
          
          // Aggiungi marker personalizzato
          const customIcon = L.divIcon({
            className: 'custom-location-marker',
            html: `<div style="background: #00d4ff; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });
          
          const marker = L.marker([latitude, longitude], { icon: customIcon })
            .addTo(map.current!)
            .bindPopup('<strong>La tua posizione</strong>')
            .openPopup();
          
          markersRef.current.push(marker);
          
          toast.success('Posizione rilevata!');
        },
        (error) => {
          console.error('Errore geolocalizzazione:', error);
          toast.error('Impossibile rilevare la posizione');
        }
      );
    } else {
      toast.error('Geolocalizzazione non supportata');
    }
  };

  const calculateRoute = async () => {
    if (!startPoint.trim() || !endPoint.trim()) {
      toast.error('Inserisci partenza e destinazione');
      return;
    }

    try {
      // Geocodifica partenza
      const startResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(startPoint)}&limit=1`
      );
      const startData = await startResponse.json();

      // Geocodifica destinazione
      const endResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endPoint)}&limit=1`
      );
      const endData = await endResponse.json();

      if (!startData.length || !endData.length) {
        toast.error('Luoghi non trovati');
        return;
      }

      const startLatLng: L.LatLng = L.latLng(parseFloat(startData[0].lat), parseFloat(startData[0].lon));
      const endLatLng: L.LatLng = L.latLng(parseFloat(endData[0].lat), parseFloat(endData[0].lon));

      // Rimuovi routing precedente
      if (routingControlRef.current) {
        map.current?.removeControl(routingControlRef.current);
      }

      // Crea routing control
      routingControlRef.current = L.Routing.control({
        waypoints: [startLatLng, endLatLng],
        routeWhileDragging: true,
        showAlternatives: true,
        fitSelectedRoutes: true,
        lineOptions: {
          styles: [{ color: 'hsl(var(--primary))', weight: 6, opacity: 0.8 }],
          extendToWaypoints: true,
          missingRouteTolerance: 0
        },
        altLineOptions: {
          styles: [{ color: 'hsl(var(--muted-foreground))', weight: 4, opacity: 0.5 }],
          extendToWaypoints: true,
          missingRouteTolerance: 0
        },
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1'
        })
      }).addTo(map.current!);

      toast.success('Percorso calcolato!');
    } catch (error) {
      console.error('Errore calcolo percorso:', error);
      toast.error('Errore nel calcolo del percorso');
    }
  };

  const clearRoute = () => {
    if (routingControlRef.current) {
      map.current?.removeControl(routingControlRef.current);
      routingControlRef.current = null;
    }
    setStartPoint('');
    setEndPoint('');
    toast.success('Percorso rimosso');
  };

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Search Bar / Navigation */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-[1000]">
        <div className="glass-panel rounded-xl p-3 shadow-elegant">
          {!isNavigationMode ? (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Cerca luoghi, indirizzi, città..."
                  className="pl-10 border-0 bg-background/50 focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
              <Button 
                onClick={handleSearch}
                disabled={isSearching}
                size="icon"
                className="shrink-0"
              >
                <Search className="h-5 w-5" />
              </Button>
              <Button 
                onClick={() => setIsNavigationMode(true)}
                variant="outline"
                size="icon"
                className="shrink-0"
                title="Modalità navigazione"
              >
                <Route className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">Navigatore</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsNavigationMode(false);
                    clearRoute();
                  }}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Input
                    value={startPoint}
                    onChange={(e) => setStartPoint(e.target.value)}
                    placeholder="Partenza..."
                    className="border-0 bg-background/50"
                  />
                  <Input
                    value={endPoint}
                    onChange={(e) => setEndPoint(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && calculateRoute()}
                    placeholder="Destinazione..."
                    className="border-0 bg-background/50"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={calculateRoute} size="icon">
                    <Route className="h-5 w-5" />
                  </Button>
                  <Button onClick={clearRoute} variant="outline" size="icon">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Control Panel */}
      <div className="absolute top-6 right-6 z-[1000] flex flex-col gap-3">
        <div className="glass-panel rounded-xl p-2 shadow-glass">
          <Button
            variant={mapLayer === 'streets' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setMapLayer('streets')}
            className="w-12 h-12"
            title="Vista stradale"
          >
            <MapIcon className="h-5 w-5" />
          </Button>
          <Button
            variant={mapLayer === 'satellite' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setMapLayer('satellite')}
            className="w-12 h-12"
            title="Vista satellitare"
          >
            <Satellite className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="glass-panel rounded-xl p-2 shadow-glass">
          <Button
            variant="ghost"
            size="icon"
            onClick={getUserLocation}
            className="w-12 h-12"
            title="La mia posizione"
          >
            <Navigation className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-[1000]">
        <div className="glass-panel rounded-xl p-4 shadow-glass max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Sistema OpenStreetMap</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            100% Gratuito • Open Source • Geocoding • Multi-layer • Real-time
          </p>
        </div>
      </div>
    </div>
  );
};

export default MapView;

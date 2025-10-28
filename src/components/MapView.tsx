import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Map as MapIcon, Satellite, Navigation, Layers, Route, X, Car, Bus, ArrowRight } from 'lucide-react';
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

interface RouteInstruction {
  text: string;
  distance: number;
  time: number;
  index: number;
}

const MapView = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [mapLayer, setMapLayer] = useState<'streets' | 'satellite'>('streets');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isNavigationMode, setIsNavigationMode] = useState(false);
  const [startPoint, setStartPoint] = useState('');
  const [endPoint, setEndPoint] = useState('');
  const [transportMode, setTransportMode] = useState<'driving' | 'transit'>('driving');
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [currentHeading, setCurrentHeading] = useState<number>(0);
  const [routeInstructions, setRouteInstructions] = useState<RouteInstruction[]>([]);
  const [currentInstruction, setCurrentInstruction] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const markersRef = useRef<L.Marker[]>([]);
  const routingControlRef = useRef<L.Routing.Control | null>(null);
  const locationMarkerRef = useRef<L.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const transitMarkersRef = useRef<L.Marker[]>([]);
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

  // Effetto per ruotare la mappa durante la navigazione
  useEffect(() => {
    if (isNavigating && map.current && mapContainer.current) {
      const mapElement = mapContainer.current.querySelector('.leaflet-map-pane') as HTMLElement;
      if (mapElement) {
        mapElement.style.transform = `rotate(${-currentHeading}deg)`;
      }
    } else if (!isNavigating && mapContainer.current) {
      const mapElement = mapContainer.current.querySelector('.leaflet-map-pane') as HTMLElement;
      if (mapElement) {
        mapElement.style.transform = 'rotate(0deg)';
      }
    }
  }, [isNavigating, currentHeading]);

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

      // Rimuovi marker fermate precedenti
      transitMarkersRef.current.forEach(marker => marker.remove());
      transitMarkersRef.current = [];

      // Determina profilo di routing
      const profile = transportMode === 'driving' ? 'car' : 'foot';

      // Crea routing control
      routingControlRef.current = L.Routing.control({
        waypoints: [startLatLng, endLatLng],
        routeWhileDragging: false,
        showAlternatives: false,
        fitSelectedRoutes: true,
        lineOptions: {
          styles: [{ color: transportMode === 'driving' ? 'hsl(var(--primary))' : '#22c55e', weight: 6, opacity: 0.8 }],
          extendToWaypoints: true,
          missingRouteTolerance: 0
        },
        router: L.Routing.osrmv1({
          serviceUrl: `https://router.project-osrm.org/route/v1`,
          profile: profile
        })
      }).on('routesfound', function(e) {
        const routes = e.routes;
        const route = routes[0];
        
        // Estrai istruzioni
        const instructions: RouteInstruction[] = route.instructions.map((instruction: any, index: number) => ({
          text: instruction.text,
          distance: instruction.distance,
          time: instruction.time,
          index: index
        }));
        
        setRouteInstructions(instructions);
        setTotalDistance(route.summary.totalDistance);
        setTotalTime(route.summary.totalTime);
        setCurrentInstruction(0);

        // Se modalità trasporto pubblico, aggiungi fermate simulate
        if (transportMode === 'transit') {
          const routeCoords = route.coordinates;
          const numStops = Math.min(5, Math.floor(routeCoords.length / 4));
          
          for (let i = 1; i < numStops; i++) {
            const stopIndex = Math.floor((routeCoords.length / numStops) * i);
            const stopCoord = routeCoords[stopIndex];
            
            const stopIcon = L.divIcon({
              className: 'custom-stop-marker',
              html: `<div style="background: #22c55e; width: 24px; height: 24px; border-radius: 4px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">${i}</div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            });
            
            const marker = L.marker([stopCoord.lat, stopCoord.lng], { icon: stopIcon })
              .addTo(map.current!)
              .bindPopup(`<strong>Fermata ${i}</strong><br/>Tempo stimato: ${Math.floor(route.summary.totalTime * (stopIndex / routeCoords.length) / 60)} min`);
            
            transitMarkersRef.current.push(marker);
          }
        }
      }).addTo(map.current!);

      toast.success('Percorso calcolato!');
    } catch (error) {
      console.error('Errore calcolo percorso:', error);
      toast.error('Errore nel calcolo del percorso');
    }
  };

  const startNavigation = () => {
    if (routeInstructions.length === 0) {
      toast.error('Calcola prima un percorso');
      return;
    }

    setIsNavigating(true);
    let lastPosition: [number, number] | null = null;
    
    // Avvia tracking GPS
    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, heading } = position.coords;
          const newPos: [number, number] = [latitude, longitude];
          
          // Calcola heading se non disponibile dal GPS
          let calculatedHeading = heading || 0;
          if (lastPosition && (!heading || heading === null)) {
            const lat1 = lastPosition[0] * Math.PI / 180;
            const lat2 = latitude * Math.PI / 180;
            const lon1 = lastPosition[1] * Math.PI / 180;
            const lon2 = longitude * Math.PI / 180;
            
            const dLon = lon2 - lon1;
            const y = Math.sin(dLon) * Math.cos(lat2);
            const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
            calculatedHeading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
          }
          
          setCurrentHeading(calculatedHeading);
          setCurrentPosition(newPos);
          lastPosition = newPos;

          // Crea icona freccia che punta nella direzione del movimento
          const arrowIcon = L.divIcon({
            className: 'custom-navigation-marker',
            html: `
              <div style="
                width: 40px; 
                height: 40px; 
                display: flex; 
                align-items: center; 
                justify-content: center;
                transform: rotate(${calculatedHeading}deg);
              ">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 5 L30 35 L20 30 L10 35 Z" fill="#00d4ff" stroke="white" stroke-width="2"/>
                  <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(0, 212, 255, 0.3)" stroke-width="2"/>
                </svg>
              </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          });

          // Aggiorna marker posizione
          if (!locationMarkerRef.current) {
            locationMarkerRef.current = L.marker(newPos, { icon: arrowIcon })
              .addTo(map.current!);
          } else {
            locationMarkerRef.current.setIcon(arrowIcon);
            locationMarkerRef.current.setLatLng(newPos);
          }

          // Centra mappa sulla posizione e ruota in base alla direzione
          map.current?.setView(newPos, 18, {
            animate: true,
            duration: 0.5
          });

          // TODO: Calcola distanza dalla prossima svolta e aggiorna currentInstruction
        },
        (error) => {
          console.error('Errore GPS:', error);
          toast.error('Errore nel tracking GPS');
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000
        }
      );

      toast.success('Navigazione avviata!');
    } else {
      toast.error('GPS non disponibile');
    }
  };

  const stopNavigation = () => {
    setIsNavigating(false);
    
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (locationMarkerRef.current) {
      locationMarkerRef.current.remove();
      locationMarkerRef.current = null;
    }

    toast.success('Navigazione terminata');
  };

  const clearRoute = () => {
    if (isNavigating) {
      stopNavigation();
    }
    
    if (routingControlRef.current) {
      map.current?.removeControl(routingControlRef.current);
      routingControlRef.current = null;
    }
    
    transitMarkersRef.current.forEach(marker => marker.remove());
    transitMarkersRef.current = [];
    
    setStartPoint('');
    setEndPoint('');
    setRouteInstructions([]);
    setCurrentInstruction(0);
    setTotalDistance(0);
    setTotalTime(0);
    
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
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

              <div className="flex gap-2 bg-background/30 rounded-lg p-1">
                <Button
                  variant={transportMode === 'driving' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTransportMode('driving')}
                  className="flex-1 gap-2"
                >
                  <Car className="h-4 w-4" />
                  Auto/Moto
                </Button>
                <Button
                  variant={transportMode === 'transit' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTransportMode('transit')}
                  className="flex-1 gap-2"
                >
                  <Bus className="h-4 w-4" />
                  Autobus
                </Button>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Input
                    value={startPoint}
                    onChange={(e) => setStartPoint(e.target.value)}
                    placeholder="Partenza..."
                    className="border-0 bg-background/50"
                    disabled={isNavigating}
                  />
                  <Input
                    value={endPoint}
                    onChange={(e) => setEndPoint(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && calculateRoute()}
                    placeholder="Destinazione..."
                    className="border-0 bg-background/50"
                    disabled={isNavigating}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={calculateRoute} size="icon" disabled={isNavigating}>
                    <Route className="h-5 w-5" />
                  </Button>
                  <Button onClick={clearRoute} variant="outline" size="icon">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {routeInstructions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>📍 {(totalDistance / 1000).toFixed(1)} km</span>
                    <span>⏱️ {Math.floor(totalTime / 60)} min</span>
                  </div>
                  {!isNavigating ? (
                    <Button onClick={startNavigation} className="w-full gap-2">
                      <Navigation className="h-4 w-4" />
                      Avvia Navigazione
                    </Button>
                  ) : (
                    <Button onClick={stopNavigation} variant="destructive" className="w-full">
                      Termina Navigazione
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Control Panel */}
      <div className="absolute bottom-6 left-6 z-[1000] flex flex-col gap-3">
        <div className="glass-panel rounded-xl p-2 shadow-glass">
          <Button
            variant={mapLayer === 'streets' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setMapLayer('streets')}
            className="w-12 h-12 sm:w-14 sm:h-14"
            title="Vista stradale"
          >
            <MapIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
          <Button
            variant={mapLayer === 'satellite' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setMapLayer('satellite')}
            className="w-12 h-12 sm:w-14 sm:h-14"
            title="Vista satellitare"
          >
            <Satellite className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>
        
        <div className="glass-panel rounded-xl p-2 shadow-glass">
          <Button
            variant="ghost"
            size="icon"
            onClick={getUserLocation}
            className="w-12 h-12 sm:w-14 sm:h-14"
            title="La mia posizione"
          >
            <Navigation className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>
      </div>

      {/* Navigation Instructions Panel */}
      {isNavigating && routeInstructions.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-lg px-6">
          <div className="glass-panel rounded-xl p-4 shadow-elegant">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                <ArrowRight className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-lg mb-1">
                  {routeInstructions[currentInstruction]?.text || 'Segui il percorso'}
                </p>
                <div className="flex gap-3 text-sm text-muted-foreground">
                  <span>📍 {(routeInstructions[currentInstruction]?.distance / 1000).toFixed(1)} km</span>
                  <span>⏱️ {Math.floor((routeInstructions[currentInstruction]?.time || 0) / 60)} min</span>
                </div>
                {transportMode === 'transit' && (
                  <p className="text-xs text-muted-foreground mt-2">
                    🚏 Prossima fermata tra {Math.floor(Math.random() * 5 + 1)} min
                  </p>
                )}
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                Istruzione {currentInstruction + 1} di {routeInstructions.length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-6 right-6 z-[1000]">
        <div className="glass-panel rounded-xl p-3 sm:p-4 shadow-glass max-w-[200px] sm:max-w-xs">
          <div className="flex items-center gap-2 mb-1 sm:mb-2">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-xs sm:text-sm">Sistema OpenStreetMap</h3>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            100% Gratuito • Open Source • GPS Real-time
          </p>
        </div>
      </div>
    </div>
  );
};

export default MapView;

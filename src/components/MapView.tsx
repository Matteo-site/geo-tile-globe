import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Map as MapIcon, Satellite, Navigation, Layers, Route, X, Car, Bus, ArrowRight, PersonStanding, Settings, Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { useDevice } from '@/contexts/DeviceContext';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import MapLayersControl from './MapLayersControl';

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
  const { deviceType, setDeviceType } = useDevice();
  const { isRecording, isProcessing, startRecording, stopRecording } = useVoiceInput();
  const [recordingFor, setRecordingFor] = useState<'start' | 'end' | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [mapLayer, setMapLayer] = useState<'streets' | 'satellite'>('streets');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isNavigationMode, setIsNavigationMode] = useState(false);
  const [startPoint, setStartPoint] = useState('');
  const [endPoint, setEndPoint] = useState('');
  const [transportMode, setTransportMode] = useState<'driving' | 'transit' | 'walking'>('driving');
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [currentHeading, setCurrentHeading] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
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
  const overlayLayersRef = useRef<{
    borders: L.TileLayer | null;
    timezones: L.LayerGroup | null;
    weather: L.TileLayer | null;
    traffic: L.TileLayer | null;
  }>({
    borders: null,
    timezones: null,
    weather: null,
    traffic: null
  });
  const warZonesLayerRef = useRef<L.GeoJSON | null>(null);
  const [showWarZones, setShowWarZones] = useState(false);
  const [enabledLayers, setEnabledLayers] = useState({
    borders: false,
    timezones: false,
    weather: false,
    traffic: false
  });

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

    // Inizializza layer overlay
    // Layer confini politici
    overlayLayersRef.current.borders = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
      opacity: 0.3
    });

    // Layer fusi orari (usando dati simulati con linee)
    overlayLayersRef.current.timezones = L.layerGroup();

    // Layer meteo (OpenWeatherMap - temperatura)
    overlayLayersRef.current.weather = L.tileLayer('https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=demo', {
      attribution: '© OpenWeatherMap',
      maxZoom: 19,
      opacity: 0.6
    });

    // Layer traffico (simulato con overlay colorato)
    overlayLayersRef.current.traffic = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
      opacity: 0.4,
      className: 'traffic-layer'
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // GPS tracking in tempo reale sempre attivo
  useEffect(() => {
    if (!map.current) return;

    let lastPosition: [number, number] | null = null;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading } = position.coords;
        const newPos: [number, number] = [latitude, longitude];
        
        // Calcola heading se non disponibile
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
        
        // Calcola velocità in km/h
        const speedMps = position.coords.speed || 0;
        const speedKmh = speedMps * 3.6;
        setCurrentSpeed(speedKmh);

        // Crea icona freccia GPS
        const arrowIcon = L.divIcon({
          className: 'custom-gps-marker',
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

        // Aggiorna o crea marker GPS
        if (!locationMarkerRef.current) {
          locationMarkerRef.current = L.marker(newPos, { icon: arrowIcon })
            .addTo(map.current!)
            .bindPopup('<strong>La tua posizione</strong>');
        } else {
          locationMarkerRef.current.setIcon(arrowIcon);
          locationMarkerRef.current.setLatLng(newPos);
        }

        // Durante navigazione, centra la mappa
        if (isNavigating) {
          const zoomLevel = transportMode === 'walking' ? 17 : 18;
          map.current?.setView(newPos, zoomLevel, {
            animate: true,
            duration: 0.3
          });
        }
      },
      (error) => {
        console.error('Errore GPS:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [map.current, isNavigating, transportMode]);

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

  // Ricalcola percorso quando cambia il mezzo di trasporto
  useEffect(() => {
    if (startPoint && endPoint && routingControlRef.current) {
      calculateRoute();
    }
  }, [transportMode]);

  // Gestione layer overlay
  useEffect(() => {
    if (!map.current) return;

    Object.keys(enabledLayers).forEach((layerKey) => {
      const key = layerKey as keyof typeof enabledLayers;
      const layer = overlayLayersRef.current[key];
      
      if (enabledLayers[key] && layer) {
        if (key === 'timezones') {
          // Aggiungi linee fusi orari
          (layer as L.LayerGroup).clearLayers();
          for (let lng = -180; lng <= 180; lng += 15) {
            const line = L.polyline([
              [-90, lng],
              [90, lng]
            ], {
              color: '#8b5cf6',
              weight: 2,
              opacity: 0.6,
              dashArray: '5, 10'
            });
            (layer as L.LayerGroup).addLayer(line);
          }
        }
        if (!map.current?.hasLayer(layer)) {
          layer.addTo(map.current!);
        }
      } else if (layer && map.current?.hasLayer(layer)) {
        map.current.removeLayer(layer);
      }
    });
  }, [enabledLayers]);

  const handleLayerToggle = (layer: keyof typeof enabledLayers) => {
    setEnabledLayers(prev => ({
      ...prev,
      [layer]: !prev[layer]
    }));
    
    const layerNames = {
      borders: 'Confini Politici',
      timezones: 'Fusi Orari',
      weather: 'Meteo',
      traffic: 'Traffico'
    };
    
    toast.success(`${layerNames[layer]} ${!enabledLayers[layer] ? 'attivato' : 'disattivato'}`);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    // Easter egg: cerca "guerre"
    if (searchQuery.toLowerCase() === 'guerre') {
      await showWarZonesEasterEgg();
      return;
    }
    
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

  const showWarZonesEasterEgg = async () => {
    if (!map.current) return;

    setIsSearching(true);
    
    try {
      // Lista dei paesi attualmente in conflitto (2025)
      const countriesInConflict = [
        'Ukraine', 'Russia', 'Israel', 'Palestine', 'Syrian Arab Republic',
        'Yemen', 'Sudan', 'Myanmar', 'Somalia', 'Democratic Republic of the Congo',
        'Afghanistan', 'Iraq', 'Ethiopia', 'Mali', 'Burkina Faso', 'Niger'
      ];

      // Rimuovi layer precedente se esiste
      if (warZonesLayerRef.current) {
        map.current.removeLayer(warZonesLayerRef.current);
        warZonesLayerRef.current = null;
        setShowWarZones(false);
        setIsSearching(false);
        toast.info('Zone di conflitto nascoste');
        return;
      }

      // Fetch GeoJSON dei confini mondiali
      const response = await fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson');
      const geojsonData = await response.json();

      // Crea layer GeoJSON con stile personalizzato
      warZonesLayerRef.current = L.geoJSON(geojsonData, {
        style: (feature) => {
          const countryName = feature?.properties?.ADMIN || feature?.properties?.name || '';
          const isInConflict = countriesInConflict.some(conflict => 
            countryName.toLowerCase().includes(conflict.toLowerCase()) ||
            conflict.toLowerCase().includes(countryName.toLowerCase())
          );

          if (isInConflict) {
            return {
              fillColor: '#dc2626',
              fillOpacity: 0.6,
              color: '#991b1b',
              weight: 2,
              opacity: 1
            };
          } else {
            return {
              fillColor: 'transparent',
              fillOpacity: 0,
              color: 'transparent',
              weight: 0
            };
          }
        },
        onEachFeature: (feature, layer) => {
          const countryName = feature?.properties?.ADMIN || feature?.properties?.name || 'Sconosciuto';
          const isInConflict = countriesInConflict.some(conflict => 
            countryName.toLowerCase().includes(conflict.toLowerCase()) ||
            conflict.toLowerCase().includes(countryName.toLowerCase())
          );

          if (isInConflict) {
            layer.bindPopup(`<strong>${countryName}</strong><br/><span style="color: #dc2626;">⚠️ Area di conflitto attivo</span>`);
          }
        }
      }).addTo(map.current);

      setShowWarZones(true);
      map.current.setView([30, 20], 3, { animate: true, duration: 1.5 });

      toast.error('Zone di conflitto visualizzate', {
        description: `${countriesInConflict.length} paesi evidenziati in rosso`,
      });
    } catch (error) {
      console.error('Errore nel caricamento delle zone di conflitto:', error);
      toast.error('Errore nel caricamento dei dati');
    } finally {
      setIsSearching(false);
    }
  };

  const getUserLocation = () => {
    // Se abbiamo già la posizione corrente dal GPS tracking, centraci sopra
    if (currentPosition && map.current) {
      map.current.setView(currentPosition, 16, {
        animate: true,
        duration: 1.5,
      });
      
      // Apri popup sul marker GPS esistente
      if (locationMarkerRef.current) {
        locationMarkerRef.current.openPopup();
      }
      
      toast.success('Posizione rilevata!');
      return;
    }

    // Altrimenti richiedi la posizione
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Centra la mappa sulla posizione
          map.current?.setView([latitude, longitude], 16, {
            animate: true,
            duration: 1.5,
          });
          
          toast.success('Posizione rilevata!');
        },
        (error) => {
          console.error('Errore geolocalizzazione:', error);
          toast.error('Impossibile rilevare la posizione');
        },
        {
          enableHighAccuracy: true,
          timeout: 5000
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

      // Determina profilo di routing e colore in base al mezzo
      let profile = 'car';
      let routeColor = 'hsl(var(--primary))';
      
      if (transportMode === 'walking') {
        profile = 'foot';
        routeColor = '#f59e0b';
      } else if (transportMode === 'transit') {
        profile = 'foot'; // OSRM non supporta transit, usiamo foot come approssimazione
        routeColor = '#22c55e';
      }

      // Crea routing control
      routingControlRef.current = L.Routing.control({
        waypoints: [startLatLng, endLatLng],
        routeWhileDragging: false,
        showAlternatives: false,
        fitSelectedRoutes: true,
        lineOptions: {
          styles: [{ color: routeColor, weight: 6, opacity: 0.8 }],
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
    toast.success('Navigazione avviata! Il GPS ti seguirà in tempo reale');
  };

  const stopNavigation = () => {
    setIsNavigating(false);
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

  const handleVoiceInput = async (field: 'start' | 'end') => {
    if (isRecording) {
      try {
        const text = await stopRecording();
        if (field === 'start') {
          setStartPoint(text);
        } else {
          setEndPoint(text);
        }
        setRecordingFor(null);
      } catch (error) {
        console.error('Error in voice input:', error);
        setRecordingFor(null);
      }
    } else {
      setRecordingFor(field);
      await startRecording();
    }
  };

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Settings Button - Top Right - Always visible */}
      <div className="absolute top-4 right-4 z-[1000]">
        <Button
          onClick={() => {
            localStorage.removeItem('deviceType');
            setDeviceType(null);
          }}
          variant="outline"
          size="icon"
          className={deviceType === 'desktop' ? 'w-14 h-14' : 'w-10 h-10'}
          title="Cambia dispositivo"
        >
          <Settings className={deviceType === 'desktop' ? 'h-6 w-6' : 'h-5 w-5'} />
        </Button>
      </div>
      
      {/* Search Bar / Navigation - Hidden during navigation */}
      {!isNavigating && (
        <div className={`absolute ${
          deviceType === 'desktop' 
            ? 'top-6 left-1/2 -translate-x-1/2 w-full max-w-3xl px-8' 
            : deviceType === 'tablet'
            ? 'top-4 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6'
            : 'top-4 left-1/2 -translate-x-1/2 w-full max-w-xl px-4'
        } z-[1000]`}>
          <div className={`glass-panel rounded-xl shadow-elegant ${
            deviceType === 'desktop' ? 'p-4' : deviceType === 'tablet' ? 'p-3' : 'p-2'
          }`}>
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
                  onClick={() => {
                    setIsNavigationMode(true);
                    // Imposta automaticamente la partenza alla posizione corrente
                    if (currentPosition) {
                      setStartPoint(`${currentPosition[0].toFixed(5)}, ${currentPosition[1].toFixed(5)}`);
                      toast.success('Partenza impostata sulla tua posizione');
                    }
                  }}
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

                <div className="grid grid-cols-3 gap-2 bg-background/30 rounded-lg p-1">
                  <Button
                    variant={transportMode === 'driving' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setTransportMode('driving')}
                    className="gap-1.5 px-2 text-xs sm:text-sm sm:gap-2"
                  >
                    <Car className="h-4 w-4" />
                    <span className="hidden sm:inline">Auto/Moto</span>
                    <span className="sm:hidden">Auto</span>
                  </Button>
                  <Button
                    variant={transportMode === 'walking' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setTransportMode('walking')}
                    className="gap-1.5 px-2 text-xs sm:text-sm sm:gap-2"
                  >
                    <PersonStanding className="h-4 w-4" />
                    A piedi
                  </Button>
                  <Button
                    variant={transportMode === 'transit' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setTransportMode('transit')}
                    className="gap-1.5 px-2 text-xs sm:text-sm sm:gap-2"
                  >
                    <Bus className="h-4 w-4" />
                    <span className="hidden sm:inline">Autobus</span>
                    <span className="sm:hidden">Bus</span>
                  </Button>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 space-y-2">
                    <div className="relative">
                      <Button
                        onClick={() => {
                          if (currentPosition) {
                            setStartPoint(`${currentPosition[0].toFixed(5)}, ${currentPosition[1].toFixed(5)}`);
                            toast.success('Posizione impostata come partenza');
                          } else {
                            toast.error('Posizione GPS non disponibile');
                          }
                        }}
                        size="icon"
                        variant="ghost"
                        className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 z-10"
                        disabled={isNavigating || isProcessing || !currentPosition}
                        title="Usa posizione attuale"
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                      <Input
                        value={startPoint}
                        onChange={(e) => setStartPoint(e.target.value)}
                        placeholder="Partenza..."
                        className="border-0 bg-background/50 pl-10 pr-10"
                        disabled={isNavigating || isProcessing}
                      />
                      <Button
                        onClick={() => handleVoiceInput('start')}
                        size="icon"
                        variant="ghost"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                        disabled={isNavigating || isProcessing || (isRecording && recordingFor !== 'start')}
                        title="Usa la voce"
                      >
                        {isProcessing && recordingFor === 'start' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isRecording && recordingFor === 'start' ? (
                          <MicOff className="h-4 w-4 text-red-500 animate-pulse" />
                        ) : (
                          <Mic className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="relative">
                      <Input
                        value={endPoint}
                        onChange={(e) => setEndPoint(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && calculateRoute()}
                        placeholder="Destinazione..."
                        className="border-0 bg-background/50 pr-10"
                        disabled={isNavigating || isProcessing}
                      />
                      <Button
                        onClick={() => handleVoiceInput('end')}
                        size="icon"
                        variant="ghost"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                        disabled={isNavigating || isProcessing || (isRecording && recordingFor !== 'end')}
                        title="Usa la voce"
                      >
                        {isProcessing && recordingFor === 'end' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isRecording && recordingFor === 'end' ? (
                          <MicOff className="h-4 w-4 text-red-500 animate-pulse" />
                        ) : (
                          <Mic className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button onClick={calculateRoute} size="icon" disabled={isNavigating || isProcessing}>
                      <Route className="h-5 w-5" />
                    </Button>
                    <Button onClick={clearRoute} variant="outline" size="icon" disabled={isProcessing}>
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
      )}

      {/* Control Panel - Hidden during navigation */}
      {!isNavigating && (
        <div className={`absolute z-[1000] flex flex-col gap-3 ${
          deviceType === 'desktop' 
            ? 'bottom-8 left-8' 
            : deviceType === 'tablet'
            ? 'bottom-6 left-6'
            : 'bottom-4 left-4'
        }`}>
        <div className="glass-panel rounded-xl p-2 shadow-glass">
          <Button
            variant={mapLayer === 'streets' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setMapLayer('streets')}
            className={deviceType === 'desktop' ? 'w-16 h-16' : deviceType === 'tablet' ? 'w-14 h-14' : 'w-12 h-12'}
            title="Vista stradale"
          >
            <MapIcon className={deviceType === 'desktop' ? 'h-7 w-7' : deviceType === 'tablet' ? 'h-6 w-6' : 'h-5 w-5'} />
          </Button>
          <Button
            variant={mapLayer === 'satellite' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setMapLayer('satellite')}
            className={deviceType === 'desktop' ? 'w-16 h-16' : deviceType === 'tablet' ? 'w-14 h-14' : 'w-12 h-12'}
            title="Vista satellitare"
          >
            <Satellite className={deviceType === 'desktop' ? 'h-7 w-7' : deviceType === 'tablet' ? 'h-6 w-6' : 'h-5 w-5'} />
          </Button>
        </div>
        
        <MapLayersControl 
          deviceType={deviceType}
          layers={enabledLayers}
          onLayerToggle={handleLayerToggle}
        />
        
        <div className="glass-panel rounded-xl p-2 shadow-glass">
          <Button
            variant="ghost"
            size="icon"
            onClick={getUserLocation}
            className={deviceType === 'desktop' ? 'w-16 h-16' : deviceType === 'tablet' ? 'w-14 h-14' : 'w-12 h-12'}
            title="La mia posizione"
          >
            <Navigation className={deviceType === 'desktop' ? 'h-7 w-7' : deviceType === 'tablet' ? 'h-6 w-6' : 'h-5 w-5'} />
          </Button>
        </div>
        </div>
      )}

      {/* Navigation Mode UI - Only X and route info */}
      {isNavigating && (
        <>
          {/* Close Navigation Button - Bottom Left - Optimized for device types */}
          <div className={`absolute z-[1000] ${
            deviceType === 'desktop'
              ? 'bottom-10 left-10'
              : deviceType === 'tablet'
              ? 'bottom-8 left-8'
              : 'bottom-6 left-6'
          }`}>
            <Button
              onClick={stopNavigation}
              size="icon"
              variant="destructive"
              className={`rounded-full shadow-elegant hover:scale-105 transition-transform ${
                deviceType === 'desktop'
                  ? 'w-28 h-28'
                  : deviceType === 'tablet'
                  ? 'w-20 h-20'
                  : 'w-16 h-16'
              }`}
              title="Chiudi navigazione"
            >
              <X className={deviceType === 'desktop' ? 'h-14 w-14' : deviceType === 'tablet' ? 'h-10 w-10' : 'h-8 w-8'} />
            </Button>
          </div>

          {/* Navigation Info - Bottom Center - Optimized for device types */}
          <div className={`absolute left-1/2 -translate-x-1/2 z-[1000] ${
            deviceType === 'desktop'
              ? 'bottom-10'
              : deviceType === 'tablet'
              ? 'bottom-8'
              : 'bottom-6'
          }`}>
            <div className={`glass-panel rounded-3xl shadow-elegant ${
              deviceType === 'desktop'
                ? 'px-12 py-8'
                : deviceType === 'tablet'
                ? 'px-8 py-6'
                : 'px-6 py-4'
            }`}>
              <div className={`flex items-center ${
                deviceType === 'desktop'
                  ? 'gap-12'
                  : deviceType === 'tablet'
                  ? 'gap-8'
                  : 'gap-6'
              }`}>
                <div className="text-center">
                  <div className={`font-bold text-primary leading-none ${
                    deviceType === 'desktop'
                      ? 'text-7xl'
                      : deviceType === 'tablet'
                      ? 'text-5xl'
                      : 'text-4xl'
                  }`}>
                    {Math.floor(totalTime / 60)}
                  </div>
                  <div className={`text-muted-foreground font-semibold mt-2 ${
                    deviceType === 'desktop'
                      ? 'text-lg'
                      : deviceType === 'tablet'
                      ? 'text-base'
                      : 'text-sm'
                  }`}>minuti</div>
                </div>
                <div className={`w-px bg-border ${
                  deviceType === 'desktop'
                    ? 'h-24'
                    : deviceType === 'tablet'
                    ? 'h-20'
                    : 'h-16'
                }`}></div>
                <div className="text-center">
                  <div className={`font-bold text-primary leading-none ${
                    deviceType === 'desktop'
                      ? 'text-7xl'
                      : deviceType === 'tablet'
                      ? 'text-5xl'
                      : 'text-4xl'
                  }`}>
                    {(totalDistance / 1000).toFixed(1)}
                  </div>
                  <div className={`text-muted-foreground font-semibold mt-2 ${
                    deviceType === 'desktop'
                      ? 'text-lg'
                      : deviceType === 'tablet'
                      ? 'text-base'
                      : 'text-sm'
                  }`}>km</div>
                </div>
                <div className={`w-px bg-border ${
                  deviceType === 'desktop'
                    ? 'h-24'
                    : deviceType === 'tablet'
                    ? 'h-20'
                    : 'h-16'
                }`}></div>
                <div className="text-center">
                  <div className={`font-bold text-primary leading-none ${
                    deviceType === 'desktop'
                      ? 'text-7xl'
                      : deviceType === 'tablet'
                      ? 'text-5xl'
                      : 'text-4xl'
                  }`}>
                    {Math.round(currentSpeed)}
                  </div>
                  <div className={`text-muted-foreground font-semibold mt-2 ${
                    deviceType === 'desktop'
                      ? 'text-lg'
                      : deviceType === 'tablet'
                      ? 'text-base'
                      : 'text-sm'
                  }`}>km/h</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Legend - Hidden during navigation */}
      {!isNavigating && (
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
      )}
    </div>
  );
};

export default MapView;

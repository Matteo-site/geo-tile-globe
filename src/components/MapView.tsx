import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Map as MapIcon, Satellite, Navigation, Layers } from 'lucide-react';
import { toast } from 'sonner';

interface MapViewProps {
  apiKey: string;
}

const MapView = ({ apiKey }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!mapContainer.current || !apiKey) return;

    mapboxgl.accessToken = apiKey;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle === 'streets' 
        ? 'mapbox://styles/mapbox/streets-v12'
        : 'mapbox://styles/mapbox/satellite-streets-v12',
      projection: 'globe',
      zoom: 1.5,
      center: [12, 45],
      pitch: 45,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    map.current.scrollZoom.enable();

    map.current.on('style.load', () => {
      map.current?.setFog({
        color: 'rgb(220, 230, 255)',
        'high-color': 'rgb(180, 200, 240)',
        'horizon-blend': 0.2,
        'space-color': 'rgb(30, 50, 100)',
        'star-intensity': 0.5,
      });
    });

    const secondsPerRevolution = 240;
    const maxSpinZoom = 5;
    const slowSpinZoom = 3;
    let userInteracting = false;
    let spinEnabled = true;

    function spinGlobe() {
      if (!map.current) return;
      
      const zoom = map.current.getZoom();
      if (spinEnabled && !userInteracting && zoom < maxSpinZoom) {
        let distancePerSecond = 360 / secondsPerRevolution;
        if (zoom > slowSpinZoom) {
          const zoomDif = (maxSpinZoom - zoom) / (maxSpinZoom - slowSpinZoom);
          distancePerSecond *= zoomDif;
        }
        const center = map.current.getCenter();
        center.lng -= distancePerSecond;
        map.current.easeTo({ center, duration: 1000, easing: (n) => n });
      }
    }

    map.current.on('mousedown', () => {
      userInteracting = true;
    });
    
    map.current.on('dragstart', () => {
      userInteracting = true;
    });
    
    map.current.on('mouseup', () => {
      userInteracting = false;
      spinGlobe();
    });
    
    map.current.on('touchend', () => {
      userInteracting = false;
      spinGlobe();
    });

    map.current.on('moveend', () => {
      spinGlobe();
    });

    spinGlobe();

    return () => {
      map.current?.remove();
    };
  }, [apiKey]);

  useEffect(() => {
    if (!map.current) return;
    
    const newStyle = mapStyle === 'streets' 
      ? 'mapbox://styles/mapbox/streets-v12'
      : 'mapbox://styles/mapbox/satellite-streets-v12';
    
    map.current.setStyle(newStyle);
  }, [mapStyle]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !apiKey) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${apiKey}&limit=1`
      );
      
      if (!response.ok) throw new Error('Ricerca fallita');
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        const placeName = data.features[0].place_name;
        
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];
        
        const marker = new mapboxgl.Marker({ color: '#0080ff' })
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup().setHTML(`<strong>${placeName}</strong>`))
          .addTo(map.current!);
        
        markersRef.current.push(marker);
        
        map.current?.flyTo({
          center: [lng, lat],
          zoom: 14,
          pitch: 60,
          duration: 2000,
        });
        
        toast.success('Luogo trovato!', {
          description: placeName,
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
          const { longitude, latitude } = position.coords;
          setUserLocation([longitude, latitude]);
          
          map.current?.flyTo({
            center: [longitude, latitude],
            zoom: 14,
            pitch: 60,
            duration: 2000,
          });
          
          const marker = new mapboxgl.Marker({ color: '#00d4ff' })
            .setLngLat([longitude, latitude])
            .setPopup(new mapboxgl.Popup().setHTML('<strong>La tua posizione</strong>'))
            .addTo(map.current!);
          
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

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Search Bar */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-10">
        <div className="glass-panel rounded-xl p-3 shadow-elegant">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Cerca luoghi, indirizzi, coordinate..."
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
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="absolute top-6 right-6 z-10 flex flex-col gap-3">
        <div className="glass-panel rounded-xl p-2 shadow-glass">
          <Button
            variant={mapStyle === 'streets' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setMapStyle('streets')}
            className="w-12 h-12"
            title="Vista stradale"
          >
            <MapIcon className="h-5 w-5" />
          </Button>
          <Button
            variant={mapStyle === 'satellite' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setMapStyle('satellite')}
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
      <div className="absolute bottom-6 left-6 z-10">
        <div className="glass-panel rounded-xl p-4 shadow-glass max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Sistema di Mappatura Digitale</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Visualizzazione 3D • Ricerca geocoding • Multi-layer • Real-time
          </p>
        </div>
      </div>
    </div>
  );
};

export default MapView;

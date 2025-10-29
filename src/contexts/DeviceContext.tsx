import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type DeviceType = 'phone' | 'tablet' | 'desktop' | null;

interface DeviceContextType {
  deviceType: DeviceType;
  setDeviceType: (type: DeviceType) => void;
  isDeviceSelected: boolean;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider = ({ children }: { children: ReactNode }) => {
  const [deviceType, setDeviceTypeState] = useState<DeviceType>(null);
  const [isDeviceSelected, setIsDeviceSelected] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('deviceType') as DeviceType;
    if (saved) {
      setDeviceTypeState(saved);
      setIsDeviceSelected(true);
    }
  }, []);

  const setDeviceType = (type: DeviceType) => {
    setDeviceTypeState(type);
    if (type) {
      localStorage.setItem('deviceType', type);
      setIsDeviceSelected(true);
    }
  };

  return (
    <DeviceContext.Provider value={{ deviceType, setDeviceType, isDeviceSelected }}>
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevice = () => {
  const context = useContext(DeviceContext);
  if (context === undefined) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
};

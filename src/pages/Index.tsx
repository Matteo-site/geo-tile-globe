import MapView from '@/components/MapView';
import DeviceSelector from '@/components/DeviceSelector';
import { useDevice } from '@/contexts/DeviceContext';

const Index = () => {
  const { isDeviceSelected } = useDevice();

  if (!isDeviceSelected) {
    return <DeviceSelector />;
  }

  return <MapView />;
};

export default Index;

import { useState } from 'react';
import MapView from '@/components/MapView';
import ApiKeyInput from '@/components/ApiKeyInput';

const Index = () => {
  const [apiKey, setApiKey] = useState<string>('');

  if (!apiKey) {
    return <ApiKeyInput onApiKeySubmit={setApiKey} />;
  }

  return <MapView apiKey={apiKey} />;
};

export default Index;

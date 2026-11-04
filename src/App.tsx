import React, { useState } from 'react';
import { AudioProvider } from './components/AudioEngine';
import { PSPConsole } from './components/PSPConsole';
import { StagingDebugPanel } from './components/debug/StagingDebugPanel';

export const App: React.FC = () => {
  const [debugHitboxes, setDebugHitboxes] = useState<boolean>(false);

  return (
    <AudioProvider>
      <PSPConsole debugHitboxes={debugHitboxes} />
      <StagingDebugPanel
        debugHitboxes={debugHitboxes}
        onToggleHitboxes={setDebugHitboxes}
      />
    </AudioProvider>
  );
};

export default App;

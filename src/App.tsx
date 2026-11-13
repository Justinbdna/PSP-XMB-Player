import React, { useState } from 'react';
import { AudioProvider } from './components/AudioEngine';
import { PSPConsole } from './components/PSPConsole';
import { StagingDebugPanel } from './components/debug/StagingDebugPanel';

export const App: React.FC = () => {
  const [showHitboxes, setShowHitboxes] = useState<boolean>(false);

  return (
    <AudioProvider>
      <PSPConsole debugHitboxes={showHitboxes} />
      <StagingDebugPanel
        debugHitboxes={showHitboxes}
        onToggleHitboxes={setShowHitboxes}
      />
    </AudioProvider>
  );
};

export default App;

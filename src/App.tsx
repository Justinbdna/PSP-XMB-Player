import React from 'react';
import { AudioProvider } from './components/AudioEngine';
import { PSPConsole } from './components/PSPConsole';

export const App: React.FC = () => {
  return (
    <AudioProvider>
      <PSPConsole debugHitboxes={false} />
    </AudioProvider>
  );
};

export default App;

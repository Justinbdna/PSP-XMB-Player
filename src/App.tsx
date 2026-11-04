import React from 'react';
import { AudioProvider } from './components/AudioEngine';
import { PSPConsole } from './components/PSPConsole';

// En production sur main, aucun panneau ni artefact de debug n'est rendu
const ENABLE_DEBUG = false;

export const App: React.FC = () => {
  return (
    <AudioProvider>
      <PSPConsole debugHitboxes={ENABLE_DEBUG} />
    </AudioProvider>
  );
};

export default App;

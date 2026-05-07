import { Toaster } from 'react-hot-toast';
import { useStore } from './store';
import { SetupScreen } from './components/SetupScreen';
import { ArticleWorkspace } from './components/ArticleWorkspace';
import { ConsolidationScreen } from './components/ConsolidationScreen';

export default function App() {
  const currentScreen = useStore((s) => s.currentScreen);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Toaster position="top-right" />
      {currentScreen === 'setup' && <SetupScreen />}
      {currentScreen === 'workspace' && <ArticleWorkspace />}
      {currentScreen === 'consolidation' && <ConsolidationScreen />}
    </div>
  );
}

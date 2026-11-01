import React, { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { TopToolbar } from './components/layout/TopToolbar';
import { WorkspaceLayout } from './components/layout/WorkspaceLayout';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { UploadProgressBanner } from './components/upload/UploadProgressBanner';
import { TranscribeModal } from './components/transcription/TranscribeModal';
import { TranscriptionBanner } from './components/transcription/TranscriptionBanner';
import { ExportModal } from './components/export/ExportModal';
import { logger } from './utils/logger';

export const App: React.FC = () => {
  const { activeView, togglePlay, currentTimeMs, setCurrentTimeMs, undo, redo } = useAppStore();

  useEffect(() => {
    logger.info('App', 'AutoCaption Desktop Shell mounted');

    // Global keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Undo / Redo even if not in plain input
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        }
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'y') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          redo();
          return;
        }
      }

      // Don't intercept navigation/playback keys if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTimeMs(Math.max(0, currentTimeMs - 1000 / 30));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentTimeMs(currentTimeMs + 1000 / 30);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, currentTimeMs, setCurrentTimeMs, undo, redo]);

  return (
    <ErrorBoundary>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0b0d11] font-sans antialiased text-neutral-200">
        <TopToolbar />
        <div className="flex-1 overflow-hidden">
          {activeView === 'editor' ? <WorkspaceLayout /> : <SettingsScreen />}
        </div>
        <UploadProgressBanner />
        <TranscriptionBanner />
        <TranscribeModal />
        <ExportModal />
      </div>
    </ErrorBoundary>
  );
};

export default App;

import React, { useState } from 'react';
import {
  Film,
  RotateCcw,
  RotateCw,
  Download,
  Settings,
  LayoutGrid,
  Minus,
  Square,
  X,
  Edit2,
  Check,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../utils/cn';

export const TopToolbar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    currentProject,
    setProjectName,
    saveStatus,
    undoCount,
    redoCount,
    undo,
    redo,
    setExportModalOpen,
  } = useAppStore();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(currentProject.name);

  const handleNameSubmit = () => {
    if (nameInput.trim()) {
      setProjectName(nameInput.trim());
    } else {
      setNameInput(currentProject.name);
    }
    setIsEditingName(false);
  };

  const handleMinimize = () => {
    window.electronAPI?.minimizeWindow().catch(() => {});
  };

  const handleMaximize = () => {
    window.electronAPI?.maximizeWindow().catch(() => {});
  };

  const handleClose = () => {
    window.electronAPI?.closeWindow().catch(() => {});
  };

  return (
    <header className="flex h-11 w-full select-none items-center justify-between border-b border-[#1f2633] bg-[#0d0f14] px-3 text-neutral-300">
      {/* Left: Branding & Project Name */}
      <div className="flex items-center gap-3">
        {/* App Logo */}
        <div className="flex items-center gap-2 pr-2 border-r border-[#1f2633]">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Film className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-bold tracking-wider text-neutral-100 uppercase">
            AutoCaption
          </span>
          <span className="rounded bg-[#171b24] px-1.5 py-0.5 text-[9px] font-semibold text-neutral-400 border border-[#262e3d]">
            DESKTOP
          </span>
        </div>

        {/* Project Name Moniker */}
        <div className="flex items-center gap-1.5">
          {isEditingName ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSubmit();
                  if (e.key === 'Escape') {
                    setNameInput(currentProject.name);
                    setIsEditingName(false);
                  }
                }}
                autoFocus
                className="h-6 rounded border border-emerald-500/50 bg-[#161a23] px-2 text-xs text-neutral-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleNameSubmit}
                className="rounded p-1 hover:bg-[#1f2635] text-emerald-400"
                title="Confirm"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameInput(currentProject.name);
                setIsEditingName(true);
              }}
              className="group flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-neutral-300 hover:bg-[#181d27] hover:text-neutral-100 transition-colors"
              title="Click to rename project"
            >
              <span className="max-w-[200px] truncate">{currentProject.name}</span>
              <Edit2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 text-neutral-400 transition-opacity" />
            </button>
          )}

          {/* Save Status */}
          <div className="flex items-center gap-1.5 pl-2 text-[11px] text-neutral-400">
            {saveStatus === 'saved' && (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                <span className="hidden sm:inline">Saved</span>
              </>
            )}
            {saveStatus === 'saving' && (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="hidden sm:inline text-emerald-300">Saving...</span>
              </>
            )}
            {saveStatus === 'unsaved' && (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
                <span className="hidden sm:inline">Unsaved</span>
              </>
            )}
            {saveStatus === 'conflict' && (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="hidden sm:inline text-amber-300 font-medium">Conflict</span>
              </>
            )}
            {saveStatus === 'offline' && (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                <span className="hidden sm:inline">Saved locally</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Center: Undo/Redo & Workspace Navigation Switcher */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo Controls */}
        <div className="hidden md:flex items-center gap-1 pr-2 border-r border-[#1f2633]">
          <button
            type="button"
            onClick={undo}
            disabled={undoCount === 0}
            className="flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:bg-[#171b24] hover:text-neutral-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title={undoCount > 0 ? `Undo (Ctrl+Z) - ${undoCount} action${undoCount > 1 ? 's' : ''}` : 'Undo (Ctrl+Z) - No past actions'}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={redoCount === 0}
            className="flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:bg-[#171b24] hover:text-neutral-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title={redoCount > 0 ? `Redo (Ctrl+Y) - ${redoCount} action${redoCount > 1 ? 's' : ''}` : 'Redo (Ctrl+Y) - No future actions'}
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* View Switcher: Editor vs Settings */}
        <div className="flex items-center rounded-lg border border-[#212836] bg-[#12151c] p-0.5">
          <button
            type="button"
            onClick={() => setActiveView('editor')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all',
              activeView === 'editor'
                ? 'bg-[#1e2533] text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Editor</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('settings')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all',
              activeView === 'settings'
                ? 'bg-[#1e2533] text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            )}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Right: Export Button & Window Controls */}
      <div className="flex items-center gap-2">
        {/* Export Button (Restrained Amber) */}
        <button
          type="button"
          onClick={() => setExportModalOpen(true)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide transition-all',
            currentProject.mediaAsset || (currentProject.captionSegments && currentProject.captionSegments.length > 0)
              ? 'bg-amber-600 text-neutral-950 hover:bg-amber-500 shadow-sm'
              : 'border border-[#283142] bg-[#151922] text-neutral-400 opacity-75 hover:bg-[#1a202c]'
          )}
          title="Export burned-in video or subtitle files"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export</span>
        </button>

        {/* Window Controls (Electron window handlers) */}
        <div className="flex items-center pl-1 border-l border-[#1f2633]">
          <button
            type="button"
            onClick={handleMinimize}
            className="flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:bg-[#1c222e] hover:text-neutral-200"
            title="Minimize"
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={handleMaximize}
            className="flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:bg-[#1c222e] hover:text-neutral-200"
            title="Maximize / Restore"
          >
            <Square className="h-2.5 w-2.5" />
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:bg-red-500/20 hover:text-red-400"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};

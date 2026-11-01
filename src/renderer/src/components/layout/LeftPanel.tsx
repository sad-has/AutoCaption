import React from 'react';
import { FileVideo, FolderGit2, Type } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { MediaLibrary } from '../media/MediaLibrary';
import { ProjectsManager } from '../projects/ProjectsManager';
import { FontsManager } from '../fonts/FontsManager';
import { cn } from '../../utils/cn';

export const LeftPanel: React.FC = () => {
  const { leftPanelTab, setLeftPanelTab } = useAppStore();

  const tabs = [
    { id: 'media' as const, label: 'Media', icon: FileVideo },
    { id: 'projects' as const, label: 'Projects', icon: FolderGit2 },
    { id: 'fonts' as const, label: 'Fonts', icon: Type },
  ];

  return (
    <aside className="flex h-full flex-col border-r border-[#1f2633] bg-[#0e1117]">
      {/* Panel Tab Bar */}
      <div className="flex h-9 shrink-0 border-b border-[#1f2633] bg-[#0b0d11]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = leftPanelTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setLeftPanelTab(tab.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 px-2 text-xs font-medium transition-colors border-r border-[#191f2b] last:border-r-0',
                isActive
                  ? 'bg-[#141822] text-emerald-400 border-t-2 border-t-emerald-500'
                  : 'text-neutral-400 hover:bg-[#10131a] hover:text-neutral-200'
              )}
            >
              <Icon className="h-3 w-3" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {leftPanelTab === 'media' && <MediaLibrary />}
        {leftPanelTab === 'projects' && <ProjectsManager />}
        {leftPanelTab === 'fonts' && <FontsManager />}
      </div>
    </aside>
  );
};

import React, { useEffect, useState } from 'react';
import {
  Folder,
  Plus,
  Clock,
  Copy,
  Trash2,
  Edit2,
  Check,
  X,
  AlertTriangle,
  RotateCcw,
  Cloud,
  FileVideo,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { AspectRatio } from '@shared/types';
import { cn } from '../../utils/cn';

export const ProjectsManager: React.FC = () => {
  const {
    currentProject,
    recentProjects,
    dbProjects,
    isLoadingProjects,
    saveStatus,
    saveConflict,
    fetchProjects,
    createProject,
    openProject,
    renameProject,
    duplicateProject,
    deleteProject,
    recoverProject,
    resolveConflict,
  } = useAppStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newAspectRatio, setNewAspectRatio] = useState<AspectRatio>('9:16');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const handleStartRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleConfirmRename = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingName.trim()) {
      await renameProject(id, editingName.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      await createProject(newProjectName.trim(), newAspectRatio);
      setNewProjectName('');
      setIsCreating(false);
    }
  };

  const allProjects = dbProjects.length > 0 ? dbProjects : recentProjects;

  return (
    <div className="flex h-full flex-col p-3 text-xs text-neutral-300 overflow-y-auto">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-neutral-200 tracking-wider uppercase text-[10px]">
            Cloud Projects
          </span>
          {isLoadingProjects && <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />}
        </div>

        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-500 shadow-sm transition-colors"
        >
          <Plus className="h-3 w-3" />
          <span>New Project</span>
        </button>
      </div>

      {/* Concurrent Version Conflict Banner */}
      {saveConflict && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-300 shadow-md">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Concurrent Edit Conflict</span>
          </div>
          <p className="mt-1 text-[10px] text-amber-300/90 leading-tight">
            This project was modified in another session. Resolve by reloading the server version or overwriting.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => resolveConflict('reload')}
              className="rounded bg-amber-600/30 px-2 py-1 text-[10px] font-semibold text-amber-200 hover:bg-amber-600/40 border border-amber-500/40"
            >
              Reload Server Version
            </button>
            <button
              type="button"
              onClick={() => resolveConflict('overwrite')}
              className="rounded bg-[#1b212d] px-2 py-1 text-[10px] font-semibold text-neutral-300 hover:bg-[#252e3e] border border-[#2f394c]"
            >
              Overwrite
            </button>
          </div>
        </div>
      )}

      {/* New Project Inline Modal / Form */}
      {isCreating && (
        <form onSubmit={handleCreateSubmit} className="mb-3 rounded-lg border border-emerald-500/40 bg-[#121620] p-3 shadow-md flex flex-col gap-2">
          <div className="flex items-center justify-between text-neutral-200 font-semibold text-[11px]">
            <span>Create New Project</span>
            <button type="button" onClick={() => setIsCreating(false)} className="text-neutral-400 hover:text-neutral-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <input
            type="text"
            placeholder="Project name..."
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            autoFocus
            className="rounded border border-[#2b3548] bg-[#0b0e14] px-2 py-1 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
          />

          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] text-neutral-400">Ratio:</span>
            {(['9:16', '16:9', '1:1', '4:5'] as AspectRatio[]).map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setNewAspectRatio(ratio)}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors',
                  newAspectRatio === ratio
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-[#181e2b] text-neutral-400 hover:text-neutral-200'
                )}
              >
                {ratio}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-end gap-1.5 mt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="rounded px-2 py-1 text-[10px] text-neutral-400 hover:bg-[#1a212e]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newProjectName.trim()}
              className="rounded bg-emerald-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {/* Active Session Card */}
      <div className="mb-3 rounded-lg border border-emerald-500/30 bg-[#141b25] p-3 shadow-sm">
        <div className="flex items-center justify-between text-[10px] text-emerald-400 font-semibold uppercase">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active Project</span>
          </span>
          <span className="font-mono text-[9px] text-neutral-400">
            v{currentProject.version || 1} • {saveStatus}
          </span>
        </div>

        <div className="mt-1 font-semibold text-neutral-100 truncate text-sm">
          {currentProject.name}
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-400 font-mono">
          <span className="flex items-center gap-1">
            <Cloud className="h-3 w-3 text-emerald-400/70" />
            <span>PostgreSQL RLS</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void recoverProject(currentProject.id)}
              className="flex items-center gap-1 text-[9px] text-neutral-400 hover:text-emerald-400 transition-colors"
              title="Restore from local crash recovery snapshot"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              <span>Recover</span>
            </button>
            <span>{currentProject.aspectRatio}</span>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="space-y-2">
        {allProjects.map((proj) => {
          const isActive = proj.id === currentProject.id;
          const isEditing = editingId === proj.id;
          const isDeleting = deleteConfirmId === proj.id;

          return (
            <div
              key={proj.id}
              onClick={() => {
                if (!isActive && !isEditing && !isDeleting) {
                  void openProject(proj.id);
                }
              }}
              className={cn(
                'group relative flex flex-col gap-1 rounded-lg border p-2.5 transition-all cursor-pointer',
                isActive
                  ? 'border-emerald-500/40 bg-[#141924] shadow-sm'
                  : 'border-[#212836] bg-[#10141c] hover:border-[#323d52] hover:bg-[#141a24]'
              )}
            >
              {/* Project Title & Rename Field */}
              <div className="flex items-center justify-between gap-1">
                {isEditing ? (
                  <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      autoFocus
                      className="h-5 flex-1 rounded border border-emerald-500 bg-[#0e1219] px-1.5 text-xs text-neutral-100 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={(e) => handleConfirmRename(proj.id, e)}
                      className="rounded p-0.5 text-emerald-400 hover:bg-[#1f2736]"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelRename}
                      className="rounded p-0.5 text-neutral-400 hover:bg-[#1f2736]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <Folder className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-emerald-400' : 'text-amber-400/80')} />
                      <span className="font-medium text-neutral-200 truncate max-w-[150px]" title={proj.name}>
                        {proj.name}
                      </span>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => handleStartRename(proj.id, proj.name, e)}
                        className="rounded p-1 text-neutral-400 hover:bg-[#1f2736] hover:text-neutral-200"
                        title="Rename Project"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void duplicateProject(proj.id);
                        }}
                        className="rounded p-1 text-neutral-400 hover:bg-[#1f2736] hover:text-neutral-200"
                        title="Duplicate Project"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(proj.id);
                        }}
                        className="rounded p-1 text-neutral-400 hover:bg-red-500/20 hover:text-red-400"
                        title="Delete Project"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Delete Confirmation Overlay */}
              {isDeleting && (
                <div
                  className="mt-1 flex items-center justify-between rounded bg-red-500/10 p-1.5 border border-red-500/30 text-[10px] text-red-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span>Delete project?</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        void deleteProject(proj.id);
                        setDeleteConfirmId(null);
                      }}
                      className="rounded bg-red-600 px-2 py-0.5 font-semibold text-white hover:bg-red-500"
                    >
                      Yes, Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(null)}
                      className="rounded bg-[#1a212e] px-1.5 py-0.5 text-neutral-300 hover:bg-[#252e3e]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Project Metadata Footer */}
              <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono mt-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-neutral-500" />
                  <span>{new Date(proj.updatedAt).toLocaleDateString()}</span>
                </span>

                <div className="flex items-center gap-1.5">
                  {'videoStoragePath' in proj && proj.videoStoragePath && (
                    <span className="flex items-center gap-0.5 text-emerald-400" title="Has cloud video">
                      <FileVideo className="h-3 w-3" />
                    </span>
                  )}
                  <span className="rounded bg-[#171c26] px-1 py-0.2 border border-[#232b3a]">
                    {proj.aspectRatio}
                  </span>
                  {'version' in proj && (
                    <span className="text-[9px] text-neutral-500">v{proj.version}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

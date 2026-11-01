import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { LeftPanel } from './LeftPanel';
import { CenterPreview } from './CenterPreview';
import { RightPanel } from './RightPanel';
import { BottomTimeline } from './BottomTimeline';
import { ResizableHandle } from '../common/ResizableHandle';

export const WorkspaceLayout: React.FC = () => {
  const {
    leftPanelWidth,
    setLeftPanelWidth,
    rightPanelWidth,
    setRightPanelWidth,
    bottomPanelHeight,
    setBottomPanelHeight,
  } = useAppStore();

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#08090d]">
      {/* Top Section: Left Panel, Center Canvas, Right Panel */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* Left Panel */}
        <div
          style={{ width: `${leftPanelWidth}px` }}
          className="h-full shrink-0 overflow-hidden"
        >
          <LeftPanel />
        </div>

        {/* Left Resize Handle */}
        <ResizableHandle
          direction="horizontal"
          onResize={(delta) => setLeftPanelWidth(leftPanelWidth + delta)}
        />

        {/* Center Canvas */}
        <div className="flex-1 min-w-[340px] h-full overflow-hidden">
          <CenterPreview />
        </div>

        {/* Right Resize Handle */}
        <ResizableHandle
          direction="horizontal"
          onResize={(delta) => setRightPanelWidth(rightPanelWidth - delta)}
        />

        {/* Right Panel */}
        <div
          style={{ width: `${rightPanelWidth}px` }}
          className="h-full shrink-0 overflow-hidden"
        >
          <RightPanel />
        </div>
      </div>

      {/* Bottom Vertical Resize Handle */}
      <ResizableHandle
        direction="vertical"
        onResize={(delta) => setBottomPanelHeight(bottomPanelHeight - delta)}
      />

      {/* Bottom Timeline Section */}
      <div
        style={{ height: `${bottomPanelHeight}px` }}
        className="w-full shrink-0 overflow-hidden"
      >
        <BottomTimeline />
      </div>
    </div>
  );
};

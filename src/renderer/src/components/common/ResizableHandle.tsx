import React, { useCallback, useEffect, useState } from 'react';
import { cn } from '../../utils/cn';

interface ResizableHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  className?: string;
}

export const ResizableHandle: React.FC<ResizableHandleProps> = ({
  direction,
  onResize,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (direction === 'horizontal') {
        onResize(e.movementX);
      } else {
        onResize(e.movementY);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Prevent text selection while resizing
    document.body.style.userSelect = 'none';
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [direction, isDragging, onResize]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={cn(
        'group relative flex shrink-0 items-center justify-center transition-colors',
        direction === 'horizontal'
          ? 'w-[5px] cursor-col-resize hover:bg-emerald-500/30'
          : 'h-[5px] cursor-row-resize hover:bg-emerald-500/30',
        isDragging && 'bg-emerald-500/50',
        className
      )}
    >
      <div
        className={cn(
          'rounded-full bg-[#272e3d] group-hover:bg-emerald-400/80 transition-colors',
          direction === 'horizontal' ? 'h-8 w-[2px]' : 'h-[2px] w-8',
          isDragging && 'bg-emerald-400'
        )}
      />
    </div>
  );
};

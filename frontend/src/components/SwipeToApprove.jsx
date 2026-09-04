import { useState, useRef, useEffect, useCallback } from 'react';

export default function SwipeToApprove({
  onApprove,
  disabled = false,
  label = "Slide to Approve Recovery",
  approvedLabel = "Approved ✓ Generating Link..."
}) {
  const [dragProgress, setDragProgress] = useState(0); // 0 to 1
  const [isDragging, setIsDragging] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const containerRef = useRef(null);

  const startDrag = (e) => {
    if (disabled || isApproved) return;
    setIsDragging(true);
  };

  const handleMove = useCallback((clientX) => {
    if (!isDragging || disabled || isApproved || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const thumbWidth = 46;
    const maxDrag = rect.width - thumbWidth - 8;
    if (maxDrag <= 0) return;

    const currentX = clientX - rect.left - (thumbWidth / 2);
    const progress = Math.max(0, Math.min(1, currentX / maxDrag));
    setDragProgress(progress);

    if (progress >= 0.88) {
      setIsDragging(false);
      setIsApproved(true);
      setDragProgress(1);
      if (onApprove) onApprove();
    }
  }, [isDragging, disabled, isApproved, onApprove]);

  const handleEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragProgress < 0.88) {
      setDragProgress(0);
    }
  }, [isDragging, dragProgress]);

  useEffect(() => {
    const onMouseMove = (e) => handleMove(e.clientX);
    const onMouseUp = () => handleEnd();
    const onTouchMove = (e) => {
      if (e.touches && e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };
    const onTouchEnd = () => handleEnd();

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd);
      window.addEventListener('touchcancel', onTouchEnd);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isDragging, handleMove, handleEnd]);

  // Compute positions
  const thumbWidth = 46;
  const trackWidth = containerRef.current ? containerRef.current.clientWidth : 320;
  const maxDragPx = Math.max(0, trackWidth - thumbWidth - 8);
  const leftPx = dragProgress * maxDragPx;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        height: '52px',
        width: '100%',
        maxWidth: '420px',
        background: isApproved
          ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
          : '#0f172a',
        borderRadius: '26px',
        overflow: 'hidden',
        boxShadow: isApproved
          ? '0 0 20px rgba(16, 185, 129, 0.4), inset 0 1px 2px rgba(255,255,255,0.2)'
          : 'inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 2px rgba(255,255,255,0.05)',
        border: isApproved ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.1)',
        userSelect: 'none',
        touchAction: 'none',
        cursor: disabled || isApproved ? 'default' : isDragging ? 'grabbing' : 'grab',
        transition: isDragging ? 'none' : 'background 0.3s ease, border 0.3s ease, box-shadow 0.3s ease',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* Dynamic green progress trail fill */}
      {!isApproved && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${leftPx + thumbWidth / 2}px`,
            background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.45))',
            borderRadius: '26px 0 0 26px',
            pointerEvents: 'none',
            transition: isDragging ? 'none' : 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      )}

      {/* Shimmering background label text */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: '600',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          pointerEvents: 'none',
          paddingLeft: isApproved ? '0' : '44px',
          paddingRight: '16px',
          color: isApproved ? '#ffffff' : '#94a3b8',
          opacity: isApproved ? 1 : Math.max(0.2, 1 - dragProgress * 1.5),
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        {isApproved ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ffffff', fontWeight: '700' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {approvedLabel}
          </span>
        ) : (
          <span className="swipe-shimmer-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span>{label}</span>
            <span className="swipe-chevron-pulse" style={{ display: 'inline-block' }}>
              ❯❯
            </span>
          </span>
        )}
      </div>

      {/* Draggable Slider Knob */}
      <div
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        style={{
          position: 'absolute',
          left: '4px',
          transform: `translateX(${leftPx}px)`,
          width: `${thumbWidth}px`,
          height: `${thumbWidth}px`,
          borderRadius: '50%',
          background: isApproved
            ? '#ffffff'
            : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: isApproved ? '#059669' : '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isDragging
            ? '0 4px 16px rgba(16, 185, 129, 0.6), 0 2px 6px rgba(0,0,0,0.4)'
            : '0 2px 8px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.4)',
          cursor: disabled || isApproved ? 'default' : isDragging ? 'grabbing' : 'grab',
          transition: isDragging
            ? 'box-shadow 0.1s ease'
            : 'transform 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.3s ease, box-shadow 0.3s ease',
          zIndex: 2,
        }}
      >
        {isApproved ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: `translateX(${dragProgress * 3}px)`,
              transition: 'transform 0.1s ease'
            }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </div>
    </div>
  );
}

import React, { useState, useRef, useCallback, useEffect, createContext, useContext } from 'react';

export interface FlowingerNode<T = any> {
  id: string;
  position: { x: number; y: number };
  data: T;
  type?: string;
  className?: string;
  style?: React.CSSProperties;
}

export interface FlowingerEdge {
  id: string;
  source: string;
  target: string;
  label?: string | number;
  animated?: boolean;
  style?: React.CSSProperties;
  className?: string;
  data?: any;
}

interface FlowingerContextType {
  zoom: number;
  pan: { x: number; y: number };
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  fitView: () => void;
}

const FlowingerContext = createContext<FlowingerContextType | null>(null);

export interface FlowingerProps {
  nodes: FlowingerNode[];
  edges: FlowingerEdge[];
  onNodeClick?: (event: React.MouseEvent, node: FlowingerNode) => void;
  nodeTypes?: Record<string, React.ComponentType<{ id: string; data: any; selected?: boolean }>>;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Flowinger: React.FC<FlowingerProps> = ({
  nodes,
  edges,
  onNodeClick,
  nodeTypes,
  children,
  className = '',
  style = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(z * 1.2, 2.5));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(z / 1.2, 0.4));
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const fitView = useCallback(() => {
    if (!containerRef.current || nodes.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const minX = Math.min(...nodes.map((n) => n.position.x));
    const maxX = Math.max(...nodes.map((n) => n.position.x + 180));
    const minY = Math.min(...nodes.map((n) => n.position.y));
    const maxY = Math.max(...nodes.map((n) => n.position.y + 100));

    const graphWidth = maxX - minX || 400;
    const graphHeight = maxY - minY || 300;

    const scaleX = (rect.width - 80) / graphWidth;
    const scaleY = (rect.height - 80) / graphHeight;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.5), 1.4);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setZoom(newZoom);
    setPan({
      x: rect.width / 2 - centerX * newZoom,
      y: rect.height / 2 - centerY * newZoom,
    });
  }, [nodes]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.flowinger-node') || (e.target as HTMLElement).closest('.flowinger-controls')) {
      return;
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(Math.max(z * delta, 0.4), 2.5));
  };

  // Node position lookup map
  const nodeMap = new Map<string, FlowingerNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  return (
    <FlowingerContext.Provider value={{ zoom, pan, zoomIn, zoomOut, resetView, fitView }}>
      <div
        ref={containerRef}
        className={`relative w-full h-full overflow-hidden select-none bg-gray-950 cursor-grab active:cursor-grabbing ${className}`}
        style={style}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        {children}

        {/* Scaled/Panned Graph Layer */}
        <div
          className="absolute inset-0 origin-top-left transition-transform duration-75"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* SVG Edges Layer */}
          <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
            <defs>
              <marker
                id="arrowhead-up"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <polygon points="0 1, 8 4, 0 7" fill="#10b981" />
              </marker>
              <marker
                id="arrowhead-down"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <polygon points="0 1, 8 4, 0 7" fill="#ef4444" />
              </marker>
              <marker
                id="arrowhead-degraded"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <polygon points="0 1, 8 4, 0 7" fill="#f59e0b" />
              </marker>
              <marker
                id="arrowhead-alternate"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <polygon points="0 1, 8 4, 0 7" fill="#3b82f6" />
              </marker>
            </defs>

            {edges.map((edge) => {
              const srcNode = nodeMap.get(edge.source);
              const tgtNode = nodeMap.get(edge.target);
              if (!srcNode || !tgtNode) return null;

              // Estimated node center (assuming ~170px width, ~60px height)
              const srcX = srcNode.position.x + 85;
              const srcY = srcNode.position.y + 30;
              const tgtX = tgtNode.position.x + 85;
              const tgtY = tgtNode.position.y + 30;

              // Calculate control points for gentle curve
              const dx = tgtX - srcX;
              const dy = tgtY - srcY;
              const cx1 = srcX + dx * 0.4;
              const cy1 = srcY;
              const cx2 = srcX + dx * 0.6;
              const cy2 = tgtY;

              const pathData = `M ${srcX} ${srcY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tgtX} ${tgtY}`;
              const midX = (srcX + tgtX) / 2;
              const midY = (srcY + tgtY) / 2;

              const strokeColor =
                (edge.style?.stroke as string) ||
                (edge.data?.status === 'down'
                  ? '#ef4444'
                  : edge.data?.status === 'degraded'
                  ? '#f59e0b'
                  : edge.data?.isAlternate
                  ? '#3b82f6'
                  : '#10b981');

              const isAnimated = edge.animated || edge.data?.animated;

              return (
                <g key={edge.id} className="transition-all duration-300">
                  {/* Background shadow stroke */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="6"
                    opacity="0.8"
                  />
                  {/* Foreground stroke */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={edge.data?.isAlternate ? 4 : 2.5}
                    strokeDasharray={isAnimated ? '6 4' : undefined}
                    className={isAnimated ? 'animate-[dash_1s_linear_infinite]' : ''}
                    opacity={edge.data?.status === 'down' ? 0.4 : 0.9}
                  />
                  {/* Edge label badge */}
                  {edge.label && (
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x="-24"
                        y="-10"
                        width="48"
                        height="20"
                        rx="4"
                        fill="#1e293b"
                        stroke={strokeColor}
                        strokeWidth="1"
                        className="opacity-95"
                      />
                      <text
                        x="0"
                        y="4"
                        fill="#e2e8f0"
                        fontSize="10"
                        fontFamily="monospace"
                        textAnchor="middle"
                        fontWeight="600"
                      >
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Nodes Layer */}
          {nodes.map((node) => {
            const CustomComponent = node.type && nodeTypes ? nodeTypes[node.type] : null;
            const isSelected = selectedNodeId === node.id;

            return (
              <div
                key={node.id}
                className={`flowinger-node absolute cursor-pointer select-none transition-transform duration-150 hover:scale-105 ${node.className || ''}`}
                style={{
                  transform: `translate(${node.position.x}px, ${node.position.y}px)`,
                  ...node.style,
                }}
                onClick={(e) => {
                  setSelectedNodeId(node.id);
                  onNodeClick?.(e, node);
                }}
              >
                {CustomComponent ? (
                  <CustomComponent id={node.id} data={node.data} selected={isSelected} />
                ) : (
                  <div
                    className={`px-4 py-2.5 rounded-xl border shadow-lg backdrop-blur bg-gray-900/90 text-sm font-medium ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/30'
                        : 'border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          node.data?.status === 'down'
                            ? 'bg-red-500'
                            : node.data?.status === 'degraded'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                      />
                      <span className="text-gray-200">{node.data?.label || node.id}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </FlowingerContext.Provider>
  );
};

export const Background: React.FC<{
  color?: string;
  gap?: number;
  size?: number;
}> = ({ color = '#334155', gap = 24, size = 1 }) => {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-20"
      style={{
        backgroundImage: `radial-gradient(${color} ${size}px, transparent ${size}px)`,
        backgroundSize: `${gap}px ${gap}px`,
      }}
    />
  );
};

export const Controls: React.FC<{
  className?: string;
  showZoom?: boolean;
  showFit?: boolean;
  showReset?: boolean;
}> = ({ className = '', showZoom = true, showFit = true, showReset = true }) => {
  const context = useContext(FlowingerContext);
  if (!context) return null;

  return (
    <div
      className={`flowinger-controls absolute bottom-4 left-4 z-20 flex flex-col gap-1.5 bg-gray-900/90 border border-gray-700/80 p-1.5 rounded-lg shadow-xl backdrop-blur ${className}`}
    >
      {showZoom && (
        <>
          <button
            onClick={context.zoomIn}
            title="Zoom In"
            className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors text-lg font-bold"
          >
            +
          </button>
          <button
            onClick={context.zoomOut}
            title="Zoom Out"
            className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors text-lg font-bold"
          >
            −
          </button>
        </>
      )}
      {showFit && (
        <button
          onClick={context.fitView}
          title="Fit View"
          className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors text-xs font-semibold"
        >
          [ ]
        </button>
      )}
      {showReset && (
        <button
          onClick={context.resetView}
          title="Reset View"
          className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors text-xs font-semibold"
        >
          1:1
        </button>
      )}
    </div>
  );
};

export default Flowinger;

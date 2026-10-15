import React, { useMemo } from 'react';
import { Flowinger, Background, Controls, FlowingerNode, FlowingerEdge } from 'flowinger';
import { Topology, Node, Incident } from '../types';
import { Server, Router, Globe, Cpu, AlertCircle } from 'lucide-react';

interface TopologyGraphProps {
  topology: Topology;
  selectedNodeId?: string | null;
  onNodeSelect?: (node: Node | null) => void;
  activeIncident?: Incident | null;
  className?: string;
  height?: string | number;
}

/**
 * Custom Node renderer for Flowinger
 */
const NetworkNodeComponent: React.FC<{
  id: string;
  data: {
    node: Node;
    isSelected: boolean;
    isAffected: boolean;
    isAlternate: boolean;
  };
}> = ({ data }) => {
  const { node, isSelected, isAffected, isAlternate } = data;

  // Select appropriate icon
  const getIcon = () => {
    switch (node.node_type?.toLowerCase()) {
      case 'core_router':
        return <Router className="w-5 h-5 text-indigo-400" />;
      case 'gateway':
        return <Globe className="w-5 h-5 text-sky-400" />;
      case 'server':
        return <Server className="w-5 h-5 text-emerald-400" />;
      default:
        return <Cpu className="w-5 h-5 text-blue-400" />;
    }
  };

  const status = (node.status || 'up').toLowerCase();

  return (
    <div
      className={`group relative flex flex-col min-w-[170px] max-w-[210px] rounded-xl border p-3 backdrop-blur-md transition-all duration-200 shadow-lg ${
        isSelected
          ? 'border-blue-500 bg-gray-900/95 ring-2 ring-blue-500/50 shadow-blue-500/10'
          : isAffected
          ? 'border-red-500/90 bg-red-950/40 ring-2 ring-red-500/30'
          : isAlternate
          ? 'border-cyan-500/90 bg-cyan-950/30 ring-2 ring-cyan-500/30'
          : 'border-gray-800 bg-gray-900/85 hover:border-gray-700 hover:bg-gray-800/90'
      }`}
    >
      {/* Node Header: Icon, Name & Status Dot */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-1.5 rounded-lg bg-gray-800/80 border border-gray-700/60 flex-shrink-0">
            {getIcon()}
          </div>
          <span className="font-semibold text-xs text-gray-100 truncate tracking-wide">
            {node.name}
          </span>
        </div>

        {/* Status Indicator Dot */}
        <div className="flex items-center flex-shrink-0">
          <span className="relative flex h-2.5 w-2.5">
            {status !== 'up' && (
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  status === 'down' ? 'bg-red-400' : 'bg-amber-400'
                }`}
              />
            )}
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                status === 'down'
                  ? 'bg-red-500'
                  : status === 'degraded'
                  ? 'bg-amber-500'
                  : 'bg-emerald-400'
              }`}
            />
          </span>
        </div>
      </div>

      {/* Node Subtitle: IP & Type */}
      <div className="mt-2 pt-2 border-t border-gray-800/60 flex items-center justify-between text-[11px] font-mono text-gray-400">
        <span>{node.ip_address}</span>
        <span className="capitalize text-[10px] px-1.5 py-0.5 rounded bg-gray-800/80 text-gray-300">
          {node.node_type?.replace('_', ' ') || 'node'}
        </span>
      </div>

      {isAffected && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-red-400 font-medium">
          <AlertCircle className="w-3 h-3" />
          <span>Fault Detected</span>
        </div>
      )}
    </div>
  );
};

export const TopologyGraph: React.FC<TopologyGraphProps> = ({
  topology,
  selectedNodeId,
  onNodeSelect,
  activeIncident,
  className = '',
  height = '100%',
}) => {
  // Convert nodes to Flowinger format with layout positioning
  const nodes: FlowingerNode[] = useMemo(() => {
    if (!topology || !topology.nodes) return [];

    return topology.nodes.map((node, index) => {
      // Automatic ring or tiered layout if x/y are missing
      const posX =
        node.x ??
        (index % 3 === 0
          ? 120
          : index % 3 === 1
          ? 380
          : 640);
      const posY =
        node.y ?? (80 + Math.floor(index / 3) * 140);

      const isAffected =
        activeIncident?.affected_component === node.id ||
        activeIncident?.source_node === node.id ||
        (activeIncident?.status !== 'verified' && node.status === 'down');

      const isAlternate =
        !!activeIncident?.alternate_path &&
        activeIncident.alternate_path.includes(node.id);

      return {
        id: node.id,
        position: { x: posX, y: posY },
        type: 'networkNode',
        data: {
          node,
          isSelected: selectedNodeId === node.id,
          isAffected,
          isAlternate,
        },
      };
    });
  }, [topology, selectedNodeId, activeIncident]);

  // Convert links to Flowinger edges
  const edges: FlowingerEdge[] = useMemo(() => {
    if (!topology || !topology.links) return [];

    // Check alternate path pairs if incident is healing or resolved
    const altPairs = new Set<string>();
    if (activeIncident?.alternate_path && activeIncident.alternate_path.length > 1) {
      for (let i = 0; i < activeIncident.alternate_path.length - 1; i++) {
        const a = activeIncident.alternate_path[i];
        const b = activeIncident.alternate_path[i + 1];
        altPairs.add(`${a}->${b}`);
        altPairs.add(`${b}->${a}`);
      }
    }

    return topology.links.map((link) => {
      const isAlt =
        altPairs.has(`${link.source_node_id}->${link.target_node_id}`) ||
        altPairs.has(`${link.target_node_id}->${link.source_node_id}`);

      const linkStatus = (link.status || 'up').toLowerCase();

      return {
        id: link.id,
        source: link.source_node_id,
        target: link.target_node_id,
        label: isAlt ? 'HEALED' : `${link.bandwidth_mbps >= 1000 ? `${link.bandwidth_mbps / 1000}G` : `${link.bandwidth_mbps}M`}`,
        animated: linkStatus === 'up' || isAlt,
        data: {
          status: linkStatus,
          isAlternate: isAlt,
        },
        style: {
          stroke: isAlt
            ? '#3b82f6'
            : linkStatus === 'down'
            ? '#ef4444'
            : linkStatus === 'degraded'
            ? '#f59e0b'
            : '#10b981',
          strokeWidth: isAlt ? 3.5 : 2,
        },
      };
    });
  }, [topology, activeIncident]);

  const nodeTypes = useMemo(
    () => ({
      networkNode: NetworkNodeComponent,
    }),
    []
  );

  const handleNodeClick = (_e: React.MouseEvent, flowNode: FlowingerNode) => {
    if (onNodeSelect && flowNode.data?.node) {
      onNodeSelect(flowNode.data.node);
    }
  };

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-gray-800 bg-gray-950/70 shadow-2xl ${className}`}
      style={{ height }}
    >
      <Flowinger
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
      >
        <Background color="#1e293b" gap={28} size={1.2} />
        <Controls />
      </Flowinger>

      {/* Floating Network Legend */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 px-3 py-1.5 rounded-lg bg-gray-900/90 border border-gray-800 text-xs backdrop-blur shadow-md">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-gray-300">Healthy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-gray-300">Degraded</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-gray-300">Fault / Down</span>
        </div>
        {activeIncident?.alternate_path && (
          <div className="flex items-center gap-1.5 border-l border-gray-700 pl-3">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-blue-400 font-medium">Alternate Healed Path</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopologyGraph;

import { useState, useEffect, useCallback } from 'react';
import { Topology, Node, Link } from '../types';
import { getTopology } from '../services/api';
import { useWebSocket } from './useWebSocket';

/**
 * Baseline network topology fallback if backend is starting or offline
 */
const DEFAULT_TOPOLOGY: Topology = {
  nodes: [
    { id: 'node-core-1', name: 'Core-Router-A', ip_address: '10.0.0.1', node_type: 'core_router', status: 'up', x: 260, y: 80 },
    { id: 'node-core-2', name: 'Core-Router-B', ip_address: '10.0.0.2', node_type: 'core_router', status: 'up', x: 500, y: 80 },
    { id: 'node-edge-1', name: 'Edge-Switch-1', ip_address: '10.0.1.1', node_type: 'edge_router', status: 'up', x: 120, y: 220 },
    { id: 'node-edge-2', name: 'Edge-Switch-2', ip_address: '10.0.1.2', node_type: 'edge_router', status: 'up', x: 380, y: 220 },
    { id: 'node-edge-3', name: 'Edge-Switch-3', ip_address: '10.0.1.3', node_type: 'edge_router', status: 'up', x: 640, y: 220 },
    { id: 'node-gw-1', name: 'Gateway-East', ip_address: '10.0.2.1', node_type: 'gateway', status: 'up', x: 240, y: 360 },
    { id: 'node-gw-2', name: 'Gateway-West', ip_address: '10.0.2.2', node_type: 'gateway', status: 'up', x: 520, y: 360 },
  ],
  links: [
    { id: 'link-c1-c2', source_node_id: 'node-core-1', target_node_id: 'node-core-2', status: 'up', weight: 5, bandwidth_mbps: 10000 },
    { id: 'link-c1-e1', source_node_id: 'node-core-1', target_node_id: 'node-edge-1', status: 'up', weight: 10, bandwidth_mbps: 1000 },
    { id: 'link-c1-e2', source_node_id: 'node-core-1', target_node_id: 'node-edge-2', status: 'up', weight: 10, bandwidth_mbps: 1000 },
    { id: 'link-c2-e2', source_node_id: 'node-core-2', target_node_id: 'node-edge-2', status: 'up', weight: 10, bandwidth_mbps: 1000 },
    { id: 'link-c2-e3', source_node_id: 'node-core-2', target_node_id: 'node-edge-3', status: 'up', weight: 10, bandwidth_mbps: 1000 },
    { id: 'link-e1-gw1', source_node_id: 'node-edge-1', target_node_id: 'node-gw-1', status: 'up', weight: 15, bandwidth_mbps: 1000 },
    { id: 'link-e2-gw1', source_node_id: 'node-edge-2', target_node_id: 'node-gw-1', status: 'up', weight: 15, bandwidth_mbps: 1000 },
    { id: 'link-e2-gw2', source_node_id: 'node-edge-2', target_node_id: 'node-gw-2', status: 'up', weight: 15, bandwidth_mbps: 1000 },
    { id: 'link-e3-gw2', source_node_id: 'node-edge-3', target_node_id: 'node-gw-2', status: 'up', weight: 15, bandwidth_mbps: 1000 },
  ],
};

interface UseTopologyReturn {
  topology: Topology;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTopology(): UseTopologyReturn {
  const [topology, setTopology] = useState<Topology>(DEFAULT_TOPOLOGY);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { topology: wsTopology } = useWebSocket();

  const fetchTopology = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTopology();
      if (data && Array.isArray(data.nodes) && data.nodes.length > 0) {
        setTopology(data);
      }
    } catch (err: any) {
      // Retain default demo topology so user sees an active network even before backend starts
      setError(err?.message || 'Failed to fetch topology');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchTopology();
  }, [fetchTopology]);

  // Update when WebSocket delivers new topology
  useEffect(() => {
    if (wsTopology && Array.isArray(wsTopology.nodes) && wsTopology.nodes.length > 0) {
      setTopology(wsTopology);
    }
  }, [wsTopology]);

  return {
    topology,
    loading,
    error,
    refetch: fetchTopology,
  };
}

export default useTopology;

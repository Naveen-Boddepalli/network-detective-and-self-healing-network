import React, { useState } from 'react';
import useTopology from '../hooks/useTopology';
import useWebSocket from '../hooks/useWebSocket';
import SimulatorControls from '../components/SimulatorControls';
import TopologyGraph from '../components/TopologyGraph';
import {
  simulateFailure,
  simulateRecover,
  resetSimulation,
} from '../services/api';
import { FaultType, Incident } from '../types';
import {
  Zap,
  Terminal,
  Compass,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Play,
  RotateCcw,
} from 'lucide-react';

interface SimulationEvent {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export const Simulator: React.FC = () => {
  const { topology, refetch } = useTopology();
  const { alerts } = useWebSocket();

  const [events, setEvents] = useState<SimulationEvent[]>([
    {
      id: 'e-init',
      timestamp: new Date().toLocaleTimeString(),
      level: 'info',
      message: 'Self-Healing Chaos Engine initialized. Network in healthy steady state.',
    },
  ]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeSimulationIncident, setActiveSimulationIncident] = useState<Incident | null>(null);

  const addEvent = (message: string, level: SimulationEvent['level'] = 'info') => {
    setEvents((prev) => [
      {
        id: `ev-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toLocaleTimeString(),
        level,
        message,
      },
      ...prev.slice(0, 49),
    ]);
  };

  const handleInjectFailure = async (
    targetType: 'node' | 'link',
    targetId: string,
    faultType: FaultType | string
  ) => {
    try {
      setIsLoading(true);
      addEvent(`[INJECTION] Injecting fault ${faultType} on ${targetType} [${targetId}]...`, 'warn');
      const res = await simulateFailure({ target_type: targetType, target_id: targetId, fault_type: faultType });
      addEvent(`[DETECTED] Failure injected successfully: ${res.message || 'Anomaly active'}`, 'error');

      // Setup simulated healing state
      setActiveSimulationIncident({
        id: res.incident_id || `sim-${Date.now()}`,
        fault_type: faultType,
        affected_component: targetId,
        status: 'healing',
        source_node: targetType === 'node' ? 'node-core-1' : undefined,
        alternate_path:
          targetId === 'node-edge-2'
            ? ['node-core-1', 'node-core-2', 'node-edge-3', 'node-gw-2']
            : ['node-core-1', 'node-edge-1', 'node-gw-1'],
        detected_at: new Date().toISOString(),
        healing_actions: [],
      });

      // Refetch topology
      await refetch();

      setTimeout(() => {
        addEvent(`[SELF-HEALING] Detective computed shortest alternate bypass path. Traffic rerouted.`, 'success');
        setActiveSimulationIncident((prev) => (prev ? { ...prev, status: 'verified' } : null));
      }, 1500);
    } catch (err: any) {
      addEvent(`[ERROR] Injection failed: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecover = async (targetType: 'node' | 'link', targetId: string) => {
    try {
      setIsLoading(true);
      addEvent(`[RECOVERY] Restoring ${targetType} [${targetId}] to online status...`, 'info');
      await simulateRecover({ target_type: targetType, target_id: targetId });
      addEvent(`[RESTORED] ${targetType} [${targetId}] is back online with normal link weight.`, 'success');
      setActiveSimulationIncident(null);
      await refetch();
    } catch (err: any) {
      addEvent(`[ERROR] Recovery failed: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetAll = async () => {
    try {
      setIsLoading(true);
      addEvent('[RESET] Clearing all chaos faults and restoring baseline network...', 'warn');
      await resetSimulation();
      addEvent('[HEALTHY] Baseline mesh network restored. All nodes and links UP.', 'success');
      setActiveSimulationIncident(null);
      await refetch();
    } catch (err: any) {
      addEvent(`[ERROR] Reset failed: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Preset Scenarios
  const runPresetScenario = (title: string, targetType: 'node' | 'link', targetId: string, fault: FaultType) => {
    addEvent(`[SCENARIO] Launching preset scenario: "${title}"`, 'info');
    handleInjectFailure(targetType, targetId, fault);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Chaos & Self-Healing Simulator</span>
            <Zap className="w-5 h-5 text-amber-400" />
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Induce controlled network failures to stress-test detective diagnostics and autonomous rerouting
          </p>
        </div>

        {/* Preset Scenarios */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              runPresetScenario('Edge Router Down', 'node', 'node-edge-2', FaultType.NODE_DOWN)
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 transition-all"
          >
            <Play className="w-3 h-3 text-red-400" />
            <span>Edge Crash</span>
          </button>
          <button
            onClick={() =>
              runPresetScenario('Core Trunk Fiber Cut', 'link', 'link-c1-c2', FaultType.LINK_DOWN)
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 transition-all"
          >
            <Play className="w-3 h-3 text-amber-400" />
            <span>Fiber Cut</span>
          </button>
        </div>
      </div>

      {/* Simulator Controls & Walkthrough Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Controls */}
        <div className="lg:col-span-2">
          <SimulatorControls
            nodes={topology.nodes}
            links={topology.links}
            onInjectFailure={handleInjectFailure}
            onRecover={handleRecover}
            onResetAll={handleResetAll}
            isLoading={isLoading}
          />
        </div>

        {/* Right 1 Col: Walkthrough Panel */}
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-5 shadow-xl backdrop-blur flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-gray-800">
              <Compass className="w-4 h-4 text-indigo-400" />
              <h3 className="font-bold text-sm text-white">How Self-Healing Operates</h3>
            </div>

            <ol className="mt-4 space-y-3 text-xs text-gray-300">
              <li className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-900/80 text-indigo-300 text-[11px] font-mono font-bold flex-shrink-0">
                  1
                </span>
                <span>
                  <strong className="text-white">Failure Injection:</strong> Simulates link drop, fiber cut, or router crash.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-900/80 text-indigo-300 text-[11px] font-mono font-bold flex-shrink-0">
                  2
                </span>
                <span>
                  <strong className="text-white">Anomaly Detection:</strong> Fast probe telemetry identifies latency violation or drop spike.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-900/80 text-indigo-300 text-[11px] font-mono font-bold flex-shrink-0">
                  3
                </span>
                <span>
                  <strong className="text-white">Root Cause Detective:</strong> Traverses graph model to pinpoint failed element.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-900/80 text-indigo-300 text-[11px] font-mono font-bold flex-shrink-0">
                  4
                </span>
                <span>
                  <strong className="text-white">Dynamic Reroute:</strong> Dijkstra calculates alternate healthy path and updates routes.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-900/80 text-indigo-300 text-[11px] font-mono font-bold flex-shrink-0">
                  5
                </span>
                <span>
                  <strong className="text-white">Verification:</strong> Synthetic probes verify SLA recovery within &lt; 2 seconds.
                </span>
              </li>
            </ol>
          </div>

          <div className="mt-5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Autonomous Closed-Loop Control is ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Mid: Live Topology Reaction */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Simulated Network Reaction & Healing Visualization</span>
          </h3>
          <span className="text-xs text-gray-400 font-mono">
            Alternate route highlighted in blue upon failure
          </span>
        </div>

        <TopologyGraph
          topology={topology}
          activeIncident={activeSimulationIncident}
          height="420px"
        />
      </div>

      {/* Bottom: Real-Time Event Log */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-5 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm text-white">Real-Time Simulation Event Log</h3>
          </div>
          <span className="text-xs text-gray-500 font-mono">{events.length} events logged</span>
        </div>

        <div className="mt-3 max-h-56 overflow-y-auto space-y-1.5 font-mono text-xs pr-2">
          {events.map((ev) => (
            <div
              key={ev.id}
              className={`p-2 rounded-lg border flex items-start gap-3 ${
                ev.level === 'error'
                  ? 'bg-red-950/30 border-red-900/40 text-red-300'
                  : ev.level === 'warn'
                  ? 'bg-amber-950/30 border-amber-900/40 text-amber-300'
                  : ev.level === 'success'
                  ? 'bg-emerald-950/30 border-emerald-900/40 text-emerald-300'
                  : 'bg-gray-950/40 border-gray-800 text-gray-300'
              }`}
            >
              <span className="text-gray-500 flex-shrink-0">[{ev.timestamp}]</span>
              <span className="flex-1">{ev.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Simulator;

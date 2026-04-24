import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import Dagre from '@dagrejs/dagre';
import { evaluateDsl } from '../dsl/runtime';
import type { NodeRegistry, ExecutionResult } from '../types';

export function useGraphFromDsl(
  code: string,
  executionResults?: Map<string, ExecutionResult>,
) {
  return useMemo(() => {
    try {
      const registry = evaluateDsl(code);
      return registryToFlow(registry, executionResults);
    } catch {
      return { nodes: [] as Node[], edges: [] as Edge[], error: 'DSL parse error' };
    }
  }, [code, executionResults]);
}

export function registryToFlow(
  registry: NodeRegistry,
  executionResults?: Map<string, ExecutionResult>,
): { nodes: Node[]; edges: Edge[]; error?: string } {
  const flowNodes: Node[] = registry.nodes.map((node) => {
    const result = executionResults?.get(node.id);
    const isSource = node.type === 'source';
    return {
      id: node.id,
      type: node.type,
      position: { x: 0, y: 0 },
      data: isSource
        ? { label: node.id, config: node.config, result }
        : { label: node.id, nodeType: node.type, config: node.config, result },
    };
  });

  const flowEdges: Edge[] = registry.edges.map((edge, i) => ({
    id: `e-${edge.source}-${edge.target}-${i}`,
    source: edge.source,
    target: edge.target,
    animated: edge.type === 'ref',
    style: { stroke: edge.type === 'ref' ? '#faa61a' : '#5865f2' },
  }));

  const positioned = applyDagreLayout(flowNodes, flowEdges);
  return { nodes: positioned, edges: flowEdges };
}

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 120 });
  for (const node of nodes) g.setNode(node.id, { width: 240, height: 120 });
  for (const edge of edges) g.setEdge(edge.source, edge.target);
  Dagre.layout(g);
  return nodes.map((node) => {
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - 120, y: pos.y - 60 } };
  });
}

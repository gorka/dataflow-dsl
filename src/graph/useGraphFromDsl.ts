import { useMemo, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import Dagre from '@dagrejs/dagre';
import { evaluateDsl } from '../dsl/runtime';
import { findConnectedNodes } from '../dsl/execute';
import type { NodeRegistry } from '../types';

export function useGraphFromDsl(
  code: string,
  onConfigChange?: (nodeId: string, key: string, value: string) => void,
) {
  const lastValid = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });

  return useMemo(() => {
    const registry = evaluateDsl(code);
    if (registry.error) {
      return { nodes: lastValid.current.nodes, edges: lastValid.current.edges, error: registry.error };
    }
    const result = registryToFlow(registry, onConfigChange);
    lastValid.current = { nodes: result.nodes, edges: result.edges };
    return { ...result, error: undefined };
  }, [code, onConfigChange]);
}

export function registryToFlow(
  registry: NodeRegistry,
  onConfigChange?: (nodeId: string, key: string, value: string) => void,
): { nodes: Node[]; edges: Edge[]; error?: string } {
  const allNodeIds = registry.nodes.map((n) => n.id);
  const connected = findConnectedNodes(registry);
  const connectedList = registry.nodes.filter(n => connected.has(n.id));
  const nodeMap = new Map(registry.nodes.map(n => [n.id, n]));

  function chainDepth(id: string, visited: Set<string>): number {
    if (visited.has(id)) return 0;
    visited.add(id);
    const node = nodeMap.get(id);
    if (!node?.parentId) return 0;
    return 1 + chainDepth(node.parentId, visited);
  }

  function hasAncestor(id: string, targetId: string, visited: Set<string>): boolean {
    if (id === targetId) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    const node = nodeMap.get(id);
    if (!node?.parentId) return false;
    return hasAncestor(node.parentId, targetId, visited);
  }

  const inputId = connectedList.find(n => n.type === 'source' && connectedList.some(o => o.parentId === n.id))?.id
    ?? connectedList.find(n => n.type === 'source')?.id;
  const terminalNodes = connectedList.filter(n =>
    !connectedList.some(o => o.parentId === n.id) &&
    !connectedList.some(o => o.type === 'join' && (o.config as { nodeId?: string }).nodeId === n.id)
  );
  const mainChainTerminals = inputId
    ? terminalNodes.filter(n => hasAncestor(n.id, inputId, new Set()))
    : [];
  const outputCandidates = mainChainTerminals.length > 0
    ? mainChainTerminals
    : terminalNodes.length > 0 ? terminalNodes : connectedList;
  const outputId = outputCandidates.length > 0
    ? outputCandidates.reduce((best, n) => chainDepth(n.id, new Set()) >= chainDepth(best.id, new Set()) ? n : best).id
    : undefined;

  const flowNodes: Node[] = registry.nodes.map((node) => {
    const isSource = node.type === 'source';
    const configCb = onConfigChange
      ? (key: string, value: string) => onConfigChange(node.id, key, value)
      : undefined;
    const isInput = node.id === inputId;
    const isOutput = node.id === outputId;
    const role = isInput && isOutput ? 'both' as const : isInput ? 'input' as const : isOutput ? 'output' as const : undefined;
    const isConnected = connected.has(node.id);
    return {
      id: node.id,
      type: node.type,
      position: { x: 0, y: 0 },
      data: isSource
        ? { label: node.id, config: node.config, onConfigChange: configCb, nodeIds: allNodeIds, role, connected: isConnected }
        : { label: node.id, nodeType: node.type, config: node.config, onConfigChange: configCb, nodeIds: allNodeIds, role, connected: isConnected },
    };
  });

  const flowEdges: Edge[] = registry.edges.map((edge, i) => ({
    id: `e-${edge.source}-${edge.target}-${i}`,
    source: edge.source,
    target: edge.target,
    animated: edge.type === 'ref',
    style: { stroke: edge.type === 'ref' ? '#faa61a' : '#5865f2' },
    selectable: true,
    data: { edgeType: edge.type },
  }));

  const positioned = applyDagreLayout(flowNodes, flowEdges);
  return { nodes: positioned, edges: flowEdges };
}

function estimateNodeHeight(_node: Node): number {
  return 52;
}

function nodeWidth(_node: Node): number {
  return 200;
}

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 40 });
  for (const node of nodes) {
    g.setNode(node.id, { width: nodeWidth(node), height: estimateNodeHeight(node) });
  }
  for (const edge of edges) g.setEdge(edge.source, edge.target);
  Dagre.layout(g);
  const positioned = nodes.map((node) => {
    const w = nodeWidth(node);
    const h = estimateNodeHeight(node);
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - w / 2, y: pos.y - h / 2 } };
  });
  return nudgeNodesOffEdges(positioned, edges);
}

function nudgeNodesOffEdges(nodes: Node[], edges: Edge[]): Node[] {
  const result = nodes.map(n => ({ ...n, position: { ...n.position } }));
  const PADDING = 20;

  for (let iter = 0; iter < 3; iter++) {
    let moved = false;

    for (const edge of edges) {
      const edgeType = (edge.data as { edgeType?: string } | undefined)?.edgeType;
      if (edgeType === 'chain') continue;

      const src = result.find(n => n.id === edge.source);
      const tgt = result.find(n => n.id === edge.target);
      if (!src || !tgt) continue;

      const sw = nodeWidth(src);
      const sh = estimateNodeHeight(src);
      const tw = nodeWidth(tgt);

      const x1 = src.position.x + sw / 2;
      const y1 = src.position.y + sh;
      const x2 = tgt.position.x + tw / 2;
      const y2 = tgt.position.y;

      const dy = y2 - y1;
      if (dy <= 0) continue;

      for (const node of result) {
        if (node.id === edge.source || node.id === edge.target) continue;

        const nw = nodeWidth(node);
        const nh = estimateNodeHeight(node);
        const nLeft = node.position.x - PADDING;
        const nRight = node.position.x + nw + PADDING;
        const nTop = node.position.y - PADDING;
        const nBottom = node.position.y + nh + PADDING;

        const tTop = Math.max(0, (nTop - y1) / dy);
        const tBottom = Math.min(1, (nBottom - y1) / dy);
        if (tTop >= tBottom) continue;

        const exTop = x1 + tTop * (x2 - x1);
        const exBottom = x1 + tBottom * (x2 - x1);
        const eMinX = Math.min(exTop, exBottom);
        const eMaxX = Math.max(exTop, exBottom);

        if (eMaxX < nLeft || eMinX > nRight) continue;

        const nodeCenterX = node.position.x + nw / 2;
        const edgeCenterX = (eMinX + eMaxX) / 2;
        if (nodeCenterX >= edgeCenterX) {
          node.position.x = eMaxX + PADDING;
        } else {
          node.position.x = eMinX - PADDING - nw;
        }
        moved = true;
      }
    }

    if (!moved) break;
  }

  return result;
}

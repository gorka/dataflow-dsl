import type { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react';

import type { ExecutionResult } from '../types';

export interface AppState {
  code: string;
  codeHistory: string[];
  nodes: Node[];
  floatingNodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  highlightedNodeId: string | null;
  results: Map<string, ExecutionResult>;
  isRunning: boolean;
}

export type AppAction =
  | { type: 'SET_CODE'; code: string }
  | { type: 'SET_CODE_WITH_HISTORY'; code: string | ((prev: string) => string) }
  | { type: 'UNDO' }
  | { type: 'CLEAR' }
  | { type: 'LOAD_EXAMPLE'; code: string }
  | { type: 'APPLY_NODE_CHANGES'; changes: NodeChange[] }
  | { type: 'APPLY_EDGE_CHANGES'; changes: EdgeChange[] }
  | { type: 'MERGE_DSL_NODES'; dslNodes: Node[] }
  | { type: 'ADD_FLOATING_NODE'; node: Node }
  | { type: 'REMOVE_FLOATING_NODE'; id: string }
  | { type: 'SET_EDGES'; edges: Edge[] }
  | { type: 'SELECT_NODE'; id: string | null }
  | { type: 'HIGHLIGHT_NODE'; id: string | null }
  | { type: 'RUN_START' }
  | { type: 'NODE_RESULT'; nodeId: string; result: ExecutionResult }
  | { type: 'RUN_COMPLETE'; results: Map<string, ExecutionResult> }
  | { type: 'UPDATE_NODE_RESULTS'; results: Map<string, ExecutionResult> };

export const initialState: AppState = {
  code: '',
  codeHistory: [],
  nodes: [],
  floatingNodes: [],
  edges: [],
  selectedNodeId: null,
  highlightedNodeId: null,
  results: new Map(),
  isRunning: false,
};

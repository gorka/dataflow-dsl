import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';

import type { AppState, AppAction } from './appState';

const MAX_HISTORY = 200;

function pushHistory(state: AppState): string[] {
  const history = [...state.codeHistory, state.code];
  if (history.length > MAX_HISTORY) history.shift();
  return history;
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CODE':
      return { ...state, code: action.code };

    case 'SET_CODE_WITH_HISTORY': {
      const newCode = typeof action.code === 'function' ? action.code(state.code) : action.code;
      return { ...state, code: newCode, codeHistory: pushHistory(state) };
    }

    case 'UNDO': {
      if (state.codeHistory.length === 0) return state;
      const history = [...state.codeHistory];
      const prev = history.pop()!;
      return { ...state, code: prev, codeHistory: history };
    }

    case 'CLEAR':
      return {
        ...state,
        code: '',
        codeHistory: pushHistory(state),
        results: new Map(),
        selectedNodeId: null,
        highlightedNodeId: null,
        floatingNodes: [],
      };

    case 'LOAD_EXAMPLE':
      return {
        ...state,
        code: action.code,
        codeHistory: pushHistory(state),
        results: new Map(),
        selectedNodeId: null,
        highlightedNodeId: null,
        floatingNodes: [],
      };

    case 'APPLY_NODE_CHANGES':
      return { ...state, nodes: applyNodeChanges(action.changes, state.nodes) };

    case 'APPLY_EDGE_CHANGES':
      return { ...state, edges: applyEdgeChanges(action.changes, state.edges) };

    case 'MERGE_DSL_NODES': {
      const dslIds = new Set(action.dslNodes.map(n => n.id));
      const cleanedFloating = state.floatingNodes.filter(n => !dslIds.has(n.id));

      const prevMap = new Map(state.nodes.map(n => [n.id, n]));
      const usedPositions = new Set<string>();
      const merged = action.dslNodes.map(dn => {
        const existing = prevMap.get(dn.id);
        const pending = state.pendingPositions.get(dn.id);
        if (pending) usedPositions.add(dn.id);
        if (!existing && pending) return { ...dn, position: pending };
        if (!existing) return dn;
        return {
          ...dn,
          position: existing.position,
          selected: existing.selected,
          data: {
            ...dn.data,
            result: (existing.data as Record<string, unknown>).result,
            role: (dn.data as Record<string, unknown>).role,
            connected: (dn.data as Record<string, unknown>).connected,
          },
        };
      });
      const uniqueFloating = cleanedFloating.filter(n => !dslIds.has(n.id));
      const newPending = usedPositions.size > 0
        ? new Map([...state.pendingPositions].filter(([id]) => !usedPositions.has(id)))
        : state.pendingPositions;

      return {
        ...state,
        nodes: [...merged, ...uniqueFloating],
        floatingNodes: cleanedFloating,
        pendingPositions: newPending,
      };
    }

    case 'SET_PENDING_POSITION': {
      const newPositions = new Map(state.pendingPositions);
      newPositions.set(action.id, action.position);
      return { ...state, pendingPositions: newPositions };
    }

    case 'ADD_FLOATING_NODE':
      return {
        ...state,
        floatingNodes: [...state.floatingNodes, action.node],
        nodes: [...state.nodes, action.node],
      };

    case 'REMOVE_FLOATING_NODE':
      return {
        ...state,
        floatingNodes: state.floatingNodes.filter(n => n.id !== action.id),
        nodes: state.nodes.filter(n => n.id !== action.id),
      };

    case 'SET_EDGES':
      return { ...state, edges: action.edges };

    case 'SELECT_NODE': {
      const nodes = state.nodes.map(n => ({
        ...n,
        selected: n.id === action.id,
      }));
      return {
        ...state,
        selectedNodeId: action.id,
        highlightedNodeId: action.id,
        nodes,
      };
    }

    case 'HIGHLIGHT_NODE': {
      const nodes = state.nodes.map(n => ({
        ...n,
        selected: n.id === action.id,
      }));
      return { ...state, highlightedNodeId: action.id, nodes };
    }

    case 'RUN_START':
      return { ...state, isRunning: true, results: new Map() };

    case 'NODE_RESULT':
      return {
        ...state,
        results: new Map(state.results).set(action.nodeId, action.result),
      };

    case 'RUN_COMPLETE':
      return { ...state, isRunning: false, results: action.results };

    case 'UPDATE_NODE_RESULTS': {
      const nodes = state.nodes.map(n => ({
        ...n,
        data: { ...n.data, result: action.results.get(n.id) },
      }));
      return { ...state, nodes };
    }

    default:
      return state;
  }
}

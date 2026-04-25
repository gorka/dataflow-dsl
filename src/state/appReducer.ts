import type { AppState, AppAction } from './appState';

const MAX_HISTORY = 200;

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CODE':
      return { ...state, code: action.code };

    case 'SET_CODE_WITH_HISTORY': {
      const history = [...state.codeHistory, state.code];
      if (history.length > MAX_HISTORY) history.shift();
      const newCode = typeof action.code === 'function' ? action.code(state.code) : action.code;
      return { ...state, code: newCode, codeHistory: history };
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
        codeHistory: [...state.codeHistory, state.code],
        results: new Map(),
        selectedNodeId: null,
        highlightedNodeId: null,
        floatingNodes: [],
      };

    case 'LOAD_EXAMPLE':
      return {
        ...state,
        code: action.code,
        codeHistory: [...state.codeHistory, state.code],
        results: new Map(),
        selectedNodeId: null,
        highlightedNodeId: null,
        floatingNodes: [],
      };

    case 'SET_NODES':
      return { ...state, nodes: action.nodes };

    case 'MERGE_DSL_NODES': {
      const dslIds = new Set(action.dslNodes.map(n => n.id));
      const cleanedFloating = action.floatingNodes.filter(n => !dslIds.has(n.id));

      const prevMap = new Map(state.nodes.map(n => [n.id, n]));
      const merged = action.dslNodes.map(dn => {
        const existing = prevMap.get(dn.id);
        if (existing) {
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
        }
        return dn;
      });
      const uniqueFloating = cleanedFloating.filter(n => !dslIds.has(n.id));

      return {
        ...state,
        nodes: [...merged, ...uniqueFloating],
        floatingNodes: cleanedFloating.length === action.floatingNodes.length
          ? action.floatingNodes
          : cleanedFloating,
      };
    }

    case 'ADD_FLOATING_NODE':
      return { ...state, floatingNodes: [...state.floatingNodes, action.node] };

    case 'REMOVE_FLOATING_NODE':
      return { ...state, floatingNodes: state.floatingNodes.filter(n => n.id !== action.id) };

    case 'SET_FLOATING_NODES':
      return { ...state, floatingNodes: action.nodes };

    case 'SET_EDGES':
      return { ...state, edges: action.edges };

    case 'SELECT_NODE':
      return {
        ...state,
        selectedNodeId: action.id,
        highlightedNodeId: action.id,
      };

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
      const nodes = state.nodes.map(n => {
        const result = action.results.get(n.id);
        return { ...n, data: { ...n.data, result } };
      });
      return { ...state, nodes };
    }

    default:
      return state;
  }
}

import { useEffect, useRef } from 'react';
import type { Dispatch } from 'react';

import { evaluateDsl } from '../dsl/runtime';
import { removeNodeFromCode } from '../dsl/codegen';
import type { AppState, AppAction } from '../state/appState';

interface KeyboardDeps {
  dispatch: Dispatch<AppAction>;
  setCodeWithHistory: (code: string | ((prev: string) => string)) => void;
  updateConfig: (nodeId: string, key: string, value: string) => void;
}

function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  return !!el.closest('.cm-editor') || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

export function useKeyboardHandler(state: AppState, deps: KeyboardDeps) {
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  const { dispatch, setCodeWithHistory, updateConfig } = deps;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditableElement(document.activeElement)) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDelete(e, stateRef.current, dispatch, setCodeWithHistory, updateConfig);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch, setCodeWithHistory, updateConfig]);
}

function handleDelete(
  e: KeyboardEvent,
  s: AppState,
  dispatch: Dispatch<AppAction>,
  setCodeWithHistory: (code: string | ((prev: string) => string)) => void,
  updateConfig: (nodeId: string, key: string, value: string) => void,
) {
  const selectedEdge = s.edges.find(edge => {
    const el = document.querySelector(`[aria-label="Edge from ${edge.source} to ${edge.target}"]`);
    return el?.closest('.selected') != null;
  });

  if (selectedEdge) {
    e.preventDefault();
    handleEdgeDelete(selectedEdge, s, dispatch, setCodeWithHistory, updateConfig);
    return;
  }

  const selectedNode = s.nodes.find(n => n.selected);
  if (selectedNode) {
    e.preventDefault();
    handleNodeDelete(selectedNode, s, dispatch, setCodeWithHistory);
  }
}

function handleEdgeDelete(
  edge: AppState['edges'][number],
  s: AppState,
  dispatch: Dispatch<AppAction>,
  setCodeWithHistory: (code: string | ((prev: string) => string)) => void,
  updateConfig: (nodeId: string, key: string, value: string) => void,
) {
  const edgeType = (edge.data as { edgeType: string } | undefined)?.edgeType;

  if (edgeType === 'chain') {
    const registry = evaluateDsl(s.code);
    const targetNode = registry.nodes.find(n => n.id === edge.target);
    if (!targetNode) return;

    setCodeWithHistory(prev => removeNodeFromCode(prev, edge.target));
    const currentNode = s.nodes.find(n => n.id === edge.target);
    const position = currentNode?.position ?? { x: 100, y: 100 };
    dispatch({
      type: 'ADD_FLOATING_NODE',
      node: {
        id: targetNode.id,
        type: targetNode.type,
        position,
        data: { label: targetNode.id, nodeType: targetNode.type, config: targetNode.config, unlinked: true },
      },
    });
  } else if (edgeType === 'join') {
    updateConfig(edge.target, 'nodeId', '""');
  }
}

function handleNodeDelete(
  node: AppState['nodes'][number],
  s: AppState,
  dispatch: Dispatch<AppAction>,
  setCodeWithHistory: (code: string | ((prev: string) => string)) => void,
) {
  const isFloating = s.floatingNodes.some(n => n.id === node.id);
  if (isFloating) {
    dispatch({ type: 'REMOVE_FLOATING_NODE', id: node.id });
  } else {
    setCodeWithHistory(prev => removeNodeFromCode(prev, node.id));
  }
  if (s.selectedNodeId === node.id) {
    dispatch({ type: 'SELECT_NODE', id: null });
  }
}

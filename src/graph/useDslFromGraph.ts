import { useCallback } from 'react';
import { addNodeToCode, removeNodeFromCode, updateNodeConfigInCode } from '../dsl/codegen';
import type { GraphNode, NodeType, SourceConfig, FilterConfig, MapConfig, SelectConfig, JoinConfig } from '../types';

function defaultConfig(type: NodeType): GraphNode['config'] {
  switch (type) {
    case 'source':
      return { endpoint: '', method: 'GET' } satisfies SourceConfig;
    case 'filter':
      return { expression: '' } satisfies FilterConfig;
    case 'map':
      return { mapping: {} } satisfies MapConfig;
    case 'select':
      return { fields: [] } satisfies SelectConfig;
    case 'join':
      return { nodeId: '', as: '' } satisfies JoinConfig;
  }
}

export function useDslFromGraph(code: string, onCodeChange: (code: string) => void) {
  const addNode = useCallback(
    (type: NodeType, id: string, parentId?: string) => {
      const node: GraphNode = { id, type, config: defaultConfig(type), parentId };
      onCodeChange(addNodeToCode(code, node));
    },
    [code, onCodeChange],
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      onCodeChange(removeNodeFromCode(code, nodeId));
    },
    [code, onCodeChange],
  );

  const updateConfig = useCallback(
    (nodeId: string, key: string, value: string) => {
      onCodeChange(updateNodeConfigInCode(code, nodeId, key, value));
    },
    [code, onCodeChange],
  );

  return { addNode, removeNode, updateConfig };
}

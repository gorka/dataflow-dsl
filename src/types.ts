export type NodeType = 'source' | 'filter' | 'map' | 'select' | 'join';

export interface RefValue {
  __ref: true;
  nodeId: string;
  field: string;
}

export interface SourceConfig {
  endpoint: string | RefValue;
  method?: 'GET' | 'POST';
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

export interface FilterConfig {
  expression: string;
}

export interface MapConfig {
  mapping: Record<string, string>;
}

export interface SelectConfig {
  fields: string[];
}

export interface JoinConfig {
  nodeId: string;
  as?: string;
  on?: [string, string];
}

export interface GraphNode {
  id: string;
  type: NodeType;
  config: SourceConfig | FilterConfig | MapConfig | SelectConfig | JoinConfig;
  parentId?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'chain' | 'ref' | 'join';
}

export interface NodeRegistry {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Collection<T = Record<string, unknown>> {
  items: T[];
}

export interface ExecutionResult {
  nodeId: string;
  status: 'pending' | 'running' | 'success' | 'error';
  data?: Collection;
  error?: string;
  durationMs?: number;
}

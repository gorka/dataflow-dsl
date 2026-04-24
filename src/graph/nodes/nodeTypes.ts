import { SourceNode } from './SourceNode';
import { TransformNode } from './TransformNode';

export const nodeTypes = {
  source: SourceNode,
  filter: TransformNode,
  map: TransformNode,
  select: TransformNode,
  join: TransformNode,
};

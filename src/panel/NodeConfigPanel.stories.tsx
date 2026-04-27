import type { Meta, StoryObj } from '@storybook/react-vite';
import { NodeConfigPanel } from './NodeConfigPanel';

const meta: Meta<typeof NodeConfigPanel> = {
  title: 'Panel/NodeConfigPanel',
  component: NodeConfigPanel,
  decorators: [(Story) => <div style={{ width: 400, background: '#111122', padding: 12, borderRadius: 8 }}><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof NodeConfigPanel>;

const nodeIds = ['api', 'filtered', 'mapped', 'selected', 'joined'];

export const Source: Story = {
  render: () => (
    <NodeConfigPanel
      nodeId="api"
      nodeType="source"
      config={{ endpoint: 'https://api.example.com/data', method: 'GET' }}
      onConfigChange={() => {}}
      nodeIds={nodeIds}
    />
  ),
};

export const Filter: Story = {
  render: () => (
    <NodeConfigPanel
      nodeId="filtered"
      nodeType="filter"
      config={{ expression: 'age >= 18' }}
      onConfigChange={() => {}}
      nodeIds={nodeIds}
    />
  ),
};

export const Map: Story = {
  render: () => (
    <NodeConfigPanel
      nodeId="mapped"
      nodeType="map"
      config={{ mapping: { fullName: 'name', years: 'age' } }}
      onConfigChange={() => {}}
      nodeIds={nodeIds}
    />
  ),
};

export const Select: Story = {
  render: () => (
    <NodeConfigPanel
      nodeId="selected"
      nodeType="select"
      config={{ fields: ['name', 'age'] }}
      onConfigChange={() => {}}
      nodeIds={nodeIds}
    />
  ),
};

export const Join: Story = {
  render: () => (
    <NodeConfigPanel
      nodeId="joined"
      nodeType="join"
      config={{ nodeId: 'api', as: 'data' }}
      onConfigChange={() => {}}
      nodeIds={nodeIds}
    />
  ),
};

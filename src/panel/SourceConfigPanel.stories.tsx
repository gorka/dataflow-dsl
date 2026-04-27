import type { Meta, StoryObj } from '@storybook/react-vite';
import { SourceConfigPanel } from './SourceConfigPanel';

const meta: Meta<typeof SourceConfigPanel> = {
  title: 'Panel/SourceConfigPanel',
  component: SourceConfigPanel,
  decorators: [(Story) => <div style={{ width: 400, background: '#111122', padding: 12, borderRadius: 8 }}><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof SourceConfigPanel>;

const nodeIds = ['pokemon', 'species', 'profile'];

export const Empty: Story = {
  render: () => (
    <SourceConfigPanel
      config={{ endpoint: '' }}
      onConfigChange={() => {}}
      nodeIds={nodeIds}
      currentNodeId="api"
    />
  ),
};

export const WithEndpoint: Story = {
  render: () => (
    <SourceConfigPanel
      config={{ endpoint: 'https://pokeapi.co/api/v2/pokemon/25', method: 'GET' }}
      onConfigChange={() => {}}
      nodeIds={nodeIds}
      currentNodeId="pokemon"
    />
  ),
};

export const WithPlaceholderParams: Story = {
  render: () => (
    <SourceConfigPanel
      config={{
        endpoint: '{url}',
        params: { url: { __ref: true, nodeId: 'pokemon', field: 'species.url' } },
      }}
      onConfigChange={() => {}}
      nodeIds={nodeIds}
      currentNodeId="species"
    />
  ),
};

export const WithMixedParams: Story = {
  render: () => (
    <SourceConfigPanel
      config={{
        endpoint: 'https://api.example.com/{id}',
        method: 'GET',
        params: { id: '25', extra: 'test' },
      }}
      onConfigChange={() => {}}
      nodeIds={nodeIds}
      currentNodeId="api"
    />
  ),
};

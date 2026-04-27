import type { Meta, StoryObj } from '@storybook/react-vite';
import { ParamRows } from './ParamRows';
import styles from '../panel/NodeConfigPanel.module.css';

const meta: Meta<typeof ParamRows> = {
  title: 'Shared/ParamRows',
  component: ParamRows,
  decorators: [(Story) => <div style={{ width: 400 }}><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ParamRows>;

const nodeIds = ['pokemon', 'species', 'profile'];

export const Empty: Story = {
  render: () => (
    <ParamRows
      endpoint="https://api.example.com/data"
      config={{ endpoint: 'https://api.example.com/data' }}
      nodeIds={nodeIds}
      onConfigChange={() => {}}
      styles={styles}
    />
  ),
};

export const WithPlaceholders: Story = {
  render: () => (
    <ParamRows
      endpoint="https://api.example.com/{id}/data"
      config={{
        endpoint: 'https://api.example.com/{id}/data',
        params: { id: '25' },
      }}
      nodeIds={nodeIds}
      onConfigChange={() => {}}
      styles={styles}
    />
  ),
};

export const Mixed: Story = {
  name: 'Placeholder + User Params',
  render: () => (
    <ParamRows
      endpoint="{url}"
      config={{
        endpoint: '{url}',
        params: {
          url: { __ref: true, nodeId: 'pokemon', field: 'species.url' },
          limit: '10',
        },
      }}
      nodeIds={nodeIds}
      currentNodeId="species"
      onConfigChange={() => {}}
      styles={styles}
    />
  ),
};

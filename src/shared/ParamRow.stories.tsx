import type { Meta, StoryObj } from '@storybook/react-vite';
import { ParamRow } from './ParamRow';
import styles from '../panel/NodeConfigPanel.module.css';

const meta: Meta<typeof ParamRow> = {
  title: 'Shared/ParamRow',
  component: ParamRow,
  decorators: [(Story) => <div style={{ width: 400 }}><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ParamRow>;

const nodeIds = ['pokemon', 'species', 'profile'];

export const ValueMode: Story = {
  render: () => (
    <ParamRow
      paramKey="limit"
      value="10"
      nodeIds={nodeIds}
      onCommit={() => {}}
      styles={styles}
    />
  ),
};

export const RefMode: Story = {
  render: () => (
    <ParamRow
      paramKey="url"
      value={{ __ref: true, nodeId: 'pokemon', field: 'species.url' }}
      nodeIds={nodeIds}
      onCommit={() => {}}
      styles={styles}
    />
  ),
};

export const WithRemoveVal: Story = {
  name: 'Value + Remove',
  render: () => (
    <ParamRow
      paramKey="myParam"
      value="hello"
      nodeIds={nodeIds}
      onCommit={() => {}}
      onRemove={() => {}}
      styles={styles}
    />
  ),
};

export const WithRemoveRef: Story = {
  name: 'Ref + Remove',
  render: () => (
    <ParamRow
      paramKey="url"
      value={{ __ref: true, nodeId: 'pokemon', field: 'id' }}
      nodeIds={nodeIds}
      onCommit={() => {}}
      onRemove={() => {}}
      styles={styles}
    />
  ),
};

export const PlaceholderNoRemove: Story = {
  name: 'Placeholder (no remove)',
  render: () => (
    <ParamRow
      paramKey="id"
      value="25"
      nodeIds={nodeIds}
      onCommit={() => {}}
      styles={styles}
    />
  ),
};

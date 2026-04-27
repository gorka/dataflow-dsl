import type { Meta, StoryObj } from '@storybook/react-vite';
import { DocsPanel } from './DocsPanel';

const meta: Meta<typeof DocsPanel> = {
  title: 'Panel/DocsPanel',
  component: DocsPanel,
  decorators: [(Story) => <div style={{ width: 400, height: 500, background: '#111122', borderRadius: 8, overflow: 'auto' }}><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof DocsPanel>;

export const GlobalDocs: Story = {
  render: () => <DocsPanel />,
};

export const SourceDocs: Story = {
  render: () => <DocsPanel nodeType="source" />,
};

export const FilterDocs: Story = {
  render: () => <DocsPanel nodeType="filter" />,
};

export const MapDocs: Story = {
  render: () => <DocsPanel nodeType="map" />,
};

export const SelectDocs: Story = {
  render: () => <DocsPanel nodeType="select" />,
};

export const JoinDocs: Story = {
  render: () => <DocsPanel nodeType="join" />,
};

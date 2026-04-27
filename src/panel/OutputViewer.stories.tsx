import type { Meta, StoryObj } from '@storybook/react-vite';
import { OutputViewer } from './OutputViewer';

const meta: Meta<typeof OutputViewer> = {
  title: 'Panel/OutputViewer',
  component: OutputViewer,
  decorators: [(Story) => <div style={{ width: 400, height: 400, background: '#111122', borderRadius: 8, overflow: 'auto' }}><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof OutputViewer>;

const sampleData = [
  { name: 'pikachu', height: 4, weight: 60 },
  { name: 'bulbasaur', height: 7, weight: 69 },
];

export const NoResults: Story = {
  render: () => (
    <OutputViewer
      selectedNodeId="api"
      results={new Map()}
      code='source("api", { endpoint: "/data" });'
    />
  ),
};

export const Success: Story = {
  render: () => (
    <OutputViewer
      selectedNodeId="api"
      results={new Map([['api', { nodeId: 'api', status: 'success', data: { items: sampleData }, durationMs: 142 }]])}
      code='source("api", { endpoint: "/data" });'
    />
  ),
};

export const Error: Story = {
  render: () => (
    <OutputViewer
      selectedNodeId="api"
      results={new Map([['api', { nodeId: 'api', status: 'error', error: 'Failed to fetch: 404 Not Found' }]])}
      code='source("api", { endpoint: "/data" });'
    />
  ),
};

export const Running: Story = {
  render: () => (
    <OutputViewer
      selectedNodeId="api"
      results={new Map([['api', { nodeId: 'api', status: 'running' }]])}
      code='source("api", { endpoint: "/data" });'
    />
  ),
};

export const NestedData: Story = {
  render: () => (
    <OutputViewer
      selectedNodeId="api"
      results={new Map([['api', {
        nodeId: 'api',
        status: 'success' as const,
        data: { items: [
          { name: 'Romania', capital: ['Bucharest'], population: 19036031, languages: { ron: 'Romanian' }, flags: { png: 'https://flagcdn.com/w320/ro.png', svg: 'https://flagcdn.com/ro.svg' } },
          { name: 'Germany', capital: ['Berlin'], population: 83240525, languages: { deu: 'German' }, flags: { png: 'https://flagcdn.com/w320/de.png', svg: 'https://flagcdn.com/de.svg' } },
        ] },
        durationMs: 85,
      }]])}
      code='source("api", { endpoint: "/data" });'
    />
  ),
};

export const NoSelection: Story = {
  render: () => (
    <OutputViewer
      selectedNodeId={null}
      results={new Map()}
      code=""
    />
  ),
};

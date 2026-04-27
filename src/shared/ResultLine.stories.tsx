import type { Meta, StoryObj } from '@storybook/react-vite';
import { ResultLine } from './ResultLine';

const meta: Meta<typeof ResultLine> = {
  title: 'Shared/ResultLine',
  component: ResultLine,
  decorators: [(Story) => <div style={{ width: 300, fontFamily: 'monospace', fontSize: 12 }}><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ResultLine>;

const baseClass = '';
const successStyle: React.CSSProperties = { color: '#43b581' };
const errorStyle: React.CSSProperties = { color: '#e74c3c' };
const runningStyle: React.CSSProperties = { color: '#faa61a' };
const skippedStyle: React.CSSProperties = { color: '#666' };

export const Success: Story = {
  render: () => (
    <div style={successStyle}>
      <ResultLine
        result={{ nodeId: 'api', status: 'success', data: { items: [{}, {}, {}] }, durationMs: 142 }}
        className={baseClass}
      />
    </div>
  ),
};

export const Error: Story = {
  render: () => (
    <div style={errorStyle}>
      <ResultLine
        result={{ nodeId: 'api', status: 'error', error: 'Failed to fetch: 404 Not Found' }}
        className={baseClass}
      />
    </div>
  ),
};

export const Running: Story = {
  render: () => (
    <div style={runningStyle}>
      <ResultLine
        result={{ nodeId: 'api', status: 'running' }}
        className={baseClass}
      />
    </div>
  ),
};

export const Skipped: Story = {
  render: () => (
    <div style={skippedStyle}>
      <ResultLine
        result={{ nodeId: 'api', status: 'skipped' }}
        className={baseClass}
      />
    </div>
  ),
};

export const NoResult: Story = {
  render: () => <ResultLine className={baseClass} />,
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toolbar } from './Toolbar';

const meta: Meta<typeof Toolbar> = {
  title: 'UI/Toolbar',
  component: Toolbar,
};

export default meta;
type Story = StoryObj<typeof Toolbar>;

const noop = () => {};

export const Idle: Story = {
  render: () => (
    <Toolbar
      onRun={noop}
      onAutoLayout={noop}
      onClear={noop}
      onRemoveOrphans={noop}
      onExampleSelect={noop}
      isRunning={false}
      hasOrphans={false}
    />
  ),
};

export const Running: Story = {
  render: () => (
    <Toolbar
      onRun={noop}
      onAutoLayout={noop}
      onClear={noop}
      onRemoveOrphans={noop}
      onExampleSelect={noop}
      isRunning={true}
      hasOrphans={false}
    />
  ),
};

export const WithOrphans: Story = {
  render: () => (
    <Toolbar
      onRun={noop}
      onAutoLayout={noop}
      onClear={noop}
      onRemoveOrphans={noop}
      onExampleSelect={noop}
      isRunning={false}
      hasOrphans={true}
    />
  ),
};

export const WithHint: Story = {
  render: () => (
    <Toolbar
      onRun={noop}
      onAutoLayout={noop}
      onClear={noop}
      onRemoveOrphans={noop}
      onExampleSelect={noop}
      isRunning={false}
      hasOrphans={false}
      showHint
    />
  ),
};

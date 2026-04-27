import type { Meta, StoryObj } from '@storybook/react-vite';
import { NodeMenu } from './NodeMenu';
import { DndProvider } from './DndContext';

const meta: Meta<typeof NodeMenu> = {
  title: 'UI/NodeMenu',
  component: NodeMenu,
  decorators: [(Story) => (
    <DndProvider>
      <div style={{ width: 80 }}>
        <Story />
      </div>
    </DndProvider>
  )],
};

export default meta;
type Story = StoryObj<typeof NodeMenu>;

export const Default: Story = {};

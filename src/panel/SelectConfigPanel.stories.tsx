import type { Meta, StoryObj } from '@storybook/react-vite';
import { SelectConfigPanel } from './SelectConfigPanel';

const meta: Meta<typeof SelectConfigPanel> = {
  title: 'Panel/SelectConfigPanel',
  component: SelectConfigPanel,
  decorators: [(Story) => <div style={{ width: 400, background: '#111122', padding: 12, borderRadius: 8 }}><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof SelectConfigPanel>;

export const Empty: Story = {
  render: () => (
    <SelectConfigPanel
      config={{ fields: [] }}
      onConfigChange={() => {}}
      parentFields={[]}
    />
  ),
};

export const WithFields: Story = {
  render: () => (
    <SelectConfigPanel
      config={{ fields: ['name', 'height', 'weight'] }}
      onConfigChange={() => {}}
      parentFields={[]}
    />
  ),
};

export const WithAutocomplete: Story = {
  render: () => (
    <SelectConfigPanel
      config={{ fields: ['name'] }}
      onConfigChange={() => {}}
      parentFields={['name', 'age', 'email', 'address', 'address.street', 'address.city', 'address.zip']}
    />
  ),
};

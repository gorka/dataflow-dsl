import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { AutocompleteInput } from './AutocompleteInput';
import styles from '../panel/NodeConfigPanel.module.css';

const meta: Meta<typeof AutocompleteInput> = {
  title: 'Shared/AutocompleteInput',
  component: AutocompleteInput,
  decorators: [(Story) => <div style={{ width: 320 }}><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof AutocompleteInput>;

function Controlled(props: Partial<React.ComponentProps<typeof AutocompleteInput>> & { initial?: string }) {
  const [value, setValue] = useState(props.initial ?? '');
  return (
    <AutocompleteInput
      value={value}
      onChange={setValue}
      onSubmit={() => {}}
      actionLabel="+"
      styles={styles}
      {...props}
    />
  );
}

export const Empty: Story = {
  render: () => <Controlled placeholder="field name" />,
};

export const WithSuggestions: Story = {
  render: () => (
    <Controlled
      placeholder="field name"
      suggestions={['name', 'age', 'email', 'address']}
      onSuggestionSelect={() => {}}
      initial="a"
    />
  ),
};

export const WithBranches: Story = {
  render: () => (
    <Controlled
      placeholder="field name"
      suggestions={['common', 'official', 'nativeName']}
      branchPaths={new Set(['nativeName'])}
      suggestionPrefix="name."
      onSuggestionSelect={() => {}}
      onSuggestionDrillDown={() => {}}
      initial="name."
    />
  ),
};

export const WithError: Story = {
  render: () => (
    <Controlled
      placeholder="field name"
      error="field not found"
      isInvalid
      initial="nonexistent"
    />
  ),
};

export const RemoveButton: Story = {
  render: () => (
    <Controlled
      actionLabel="x"
      initial="existing_field"
    />
  ),
};

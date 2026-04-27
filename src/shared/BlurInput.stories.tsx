import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { BlurInput } from './BlurInput';
import styles from '../panel/NodeConfigPanel.module.css';

const meta: Meta<typeof BlurInput> = {
  title: 'Shared/BlurInput',
  component: BlurInput,
  decorators: [(Story) => <div style={{ width: 320 }}><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof BlurInput>;

function Controlled(props: { initial?: string; placeholder?: string }) {
  const [value, setValue] = useState(props.initial ?? '');
  return (
    <BlurInput
      className={styles.fieldInput}
      value={value}
      placeholder={props.placeholder}
      onCommit={setValue}
    />
  );
}

export const Default: Story = {
  render: () => <Controlled initial="age >= 18" />,
};

export const WithPlaceholder: Story = {
  render: () => <Controlled placeholder="enter expression..." />,
};

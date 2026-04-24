import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import styles from './DslEditor.module.css';

interface DslEditorProps {
  code: string;
  onChange: (code: string) => void;
}

const extensions = [javascript()];

export function DslEditor({ code, onChange }: DslEditorProps) {
  return (
    <div className={styles.editor}>
      <CodeMirror
        value={code}
        onChange={onChange}
        theme={oneDark}
        extensions={extensions}
        height="100%"
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          autocompletion: false,
        }}
      />
    </div>
  );
}

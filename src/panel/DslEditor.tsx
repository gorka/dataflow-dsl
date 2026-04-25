import { useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { Decoration, ViewPlugin, EditorView, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder, type Extension } from '@codemirror/state';
import type { Text } from '@codemirror/state';
import styles from './DslEditor.module.css';

interface DslEditorProps {
  code: string;
  onChange: (code: string) => void;
  selectedNodeId: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  error?: string;
  snippetNodeId?: string;
}

const NODE_CALL_RE = /^(source|filter|map|select|join)\s*\(/;

interface LineRange { fromLine: number; toLine: number }

function findNodeLineRange(doc: Text, nodeId: string): LineRange | null {
  const needle = `"${nodeId}"`;
  for (let i = 1; i <= doc.lines; i++) {
    const text = doc.line(i).text;
    const match = NODE_CALL_RE.exec(text);
    if (!match) continue;
    const argStart = text.indexOf('(', match[1].length);
    if (argStart === -1) continue;
    const afterParen = text.substring(argStart + 1).trimStart();
    if (!afterParen.startsWith(needle)) continue;

    let depth = 0;
    for (let j = i; j <= doc.lines; j++) {
      const line = doc.line(j).text;
      for (const ch of line) {
        if (ch === '(' || ch === '{' || ch === '[') depth++;
        else if (ch === ')' || ch === '}' || ch === ']') depth--;
      }
      if (depth <= 0) return { fromLine: i, toLine: j };
    }
    return { fromLine: i, toLine: doc.lines };
  }
  return null;
}

function findAllNodeRanges(doc: Text): { nodeId: string; fromLine: number; toLine: number }[] {
  const ranges: { nodeId: string; fromLine: number; toLine: number }[] = [];
  for (let i = 1; i <= doc.lines; i++) {
    const text = doc.line(i).text;
    const match = NODE_CALL_RE.exec(text);
    if (!match) continue;
    const argStart = text.indexOf('(', match[1].length);
    if (argStart === -1) continue;
    const afterParen = text.substring(argStart + 1).trimStart();
    const nameMatch = /^"([^"]+)"/.exec(afterParen);
    if (!nameMatch) continue;

    let depth = 0;
    let endLine = doc.lines;
    for (let j = i; j <= doc.lines; j++) {
      const line = doc.line(j).text;
      for (const ch of line) {
        if (ch === '(' || ch === '{' || ch === '[') depth++;
        else if (ch === ')' || ch === '}' || ch === ']') depth--;
      }
      if (depth <= 0) { endLine = j; break; }
    }
    ranges.push({ nodeId: nameMatch[1], fromLine: i, toLine: endLine });
  }
  return ranges;
}

function findNodeAtLine(doc: Text, line: number): string | null {
  const ranges = findAllNodeRanges(doc);
  for (const r of ranges) {
    if (line >= r.fromLine && line <= r.toLine) return r.nodeId;
  }
  return null;
}

function findNodeLineIndices(lines: string[], nodeId: string): [number, number] | null {
  const needle = `"${nodeId}"`;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const match = NODE_CALL_RE.exec(text);
    if (!match) continue;
    const argStart = text.indexOf('(', match[1].length);
    if (argStart === -1) continue;
    const afterParen = text.substring(argStart + 1).trimStart();
    if (!afterParen.startsWith(needle)) continue;

    let depth = 0;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '(' || ch === '{' || ch === '[') depth++;
        else if (ch === ')' || ch === '}' || ch === ']') depth--;
      }
      if (depth <= 0) return [i, j];
    }
    return [i, lines.length - 1];
  }
  return null;
}

export function extractNodeSnippet(code: string, nodeId: string): string {
  const lines = code.split('\n');
  const range = findNodeLineIndices(lines, nodeId);
  if (!range) return '';
  return lines.slice(range[0], range[1] + 1).join('\n');
}

export function spliceNodeSnippet(fullCode: string, nodeId: string, newSnippet: string): string {
  const lines = fullCode.split('\n');
  const range = findNodeLineIndices(lines, nodeId);
  if (!range) return fullCode;
  const before = lines.slice(0, range[0]);
  const after = lines.slice(range[1] + 1);
  return [...before, newSnippet, ...after].join('\n');
}

const dimDecoration = Decoration.line({ class: 'cm-dim-line' });

function buildDecorations(view: EditorView, nodeId: string): DecorationSet {
  const doc = view.state.doc;
  const range = findNodeLineRange(doc, nodeId);
  if (!range) return Decoration.none;

  const builder = new RangeSetBuilder<Decoration>();
  for (let i = 1; i <= doc.lines; i++) {
    if (i < range.fromLine || i > range.toLine) {
      builder.add(doc.line(i).from, doc.line(i).from, dimDecoration);
    }
  }
  return builder.finish();
}

function createDimExtension(selectedNodeId: string | null) {
  if (!selectedNodeId) return [];
  const nodeId = selectedNodeId;
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, nodeId);
      }
      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.decorations = buildDecorations(update.view, nodeId);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}

function createCursorTrackExtension(onNodeSelect: (nodeId: string | null) => void, lastNodeRef: React.RefObject<string | null>) {
  return EditorView.updateListener.of((update: ViewUpdate) => {
    if (!update.selectionSet && !update.docChanged) return;
    const pos = update.state.selection.main.head;
    const line = update.state.doc.lineAt(pos).number;
    const nodeId = findNodeAtLine(update.state.doc, line);
    if (nodeId !== lastNodeRef.current) {
      lastNodeRef.current = nodeId;
      onNodeSelect(nodeId);
    }
  });
}

export function DslEditor({ code, onChange, selectedNodeId, onNodeSelect, error, snippetNodeId }: DslEditorProps) {
  const lastCursorNodeRef = useRef<string | null>(null);

  const extensions = useMemo(
    () => {
      const exts: Extension[] = [javascript(), createDimExtension(selectedNodeId)];
      if (onNodeSelect) {
        exts.push(createCursorTrackExtension(onNodeSelect, lastCursorNodeRef));
      }
      return exts;
    },
    [selectedNodeId, onNodeSelect],
  );

  const snippetExtensions = useMemo(() => [javascript()], []);

  if (snippetNodeId) {
    const snippet = extractNodeSnippet(code, snippetNodeId);
    const handleSnippetChange = (newSnippet: string) => {
      onChange(spliceNodeSnippet(code, snippetNodeId, newSnippet));
    };
    return (
      <div className={styles.editor}>
        <CodeMirror
          value={snippet || `// Node "${snippetNodeId}" not found in DSL`}
          onChange={handleSnippetChange}
          theme={oneDark}
          extensions={snippetExtensions}
          height="100%"
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            autocompletion: false,
          }}
        />
      </div>
    );
  }

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
      {error && (
        <div className={styles.errorBar}>
          <span className={styles.errorIcon}>!</span>
          {error}
        </div>
      )}
    </div>
  );
}

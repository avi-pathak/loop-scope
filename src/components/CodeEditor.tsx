import { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  currentLine: number | null;
  readOnly: boolean;
}

/** Monaco-based code editor with current-line highlighting. */
export default function CodeEditor({ value, onChange, currentLine, readOnly }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);

  const handleMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
    decorationsRef.current = ed.createDecorationsCollection();
  };

  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    const decorations = decorationsRef.current;
    if (!ed || !monaco || !decorations) return;

    if (currentLine == null) {
      decorations.clear();
      return;
    }
    decorations.set([
      {
        range: new monaco.Range(currentLine, 1, currentLine, 1),
        options: {
          isWholeLine: true,
          className: 'loopscope-current-line',
          linesDecorationsClassName: 'loopscope-current-line-margin',
        },
      },
    ]);
    ed.revealLineInCenterIfOutsideViewport(currentLine);
  }, [currentLine]);

  return (
    <div className="h-full overflow-hidden rounded-xl border border-slate-700/60">
      <Editor
        height="100%"
        defaultLanguage="javascript"
        theme="vs-dark"
        value={value}
        onMount={handleMount}
        onChange={(v) => onChange(v ?? '')}
        options={{
          readOnly,
          fontSize: 13,
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbersMinChars: 3,
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: 'none',
          tabSize: 2,
          automaticLayout: true,
        }}
      />
    </div>
  );
}

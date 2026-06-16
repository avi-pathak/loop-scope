import { useEffect, useRef } from 'react';
import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useTheme } from '../lib/theme';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  currentLine: number | null;
  readOnly: boolean;
}

/** Define light + dark "blueprint" Monaco themes matching the drafting aesthetic. */
const defineBlueprintThemes: BeforeMount = (monaco) => {
  monaco.editor.defineTheme('blueprint', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: '1B2A4A' },
      { token: 'comment', foreground: '8A97AE', fontStyle: 'italic' },
      { token: 'keyword', foreground: '3949AB' },
      { token: 'string', foreground: '0F766E' },
      { token: 'number', foreground: 'B45309' },
      { token: 'type', foreground: '6D28D9' },
      { token: 'delimiter', foreground: '51607A' },
      { token: 'identifier', foreground: '1B2A4A' },
    ],
    colors: {
      'editor.background': '#F4F6F8',
      'editor.foreground': '#1B2A4A',
      'editorLineNumber.foreground': '#A9B4C8',
      'editorLineNumber.activeForeground': '#1B2A4A',
      'editorCursor.foreground': '#3949AB',
      'editor.selectionBackground': '#3949AB26',
      'editor.inactiveSelectionBackground': '#3949AB14',
      'editor.lineHighlightBackground': '#00000000',
      'editor.lineHighlightBorder': '#00000000',
      'editorIndentGuide.background1': '#1B2A4A12',
      'editorIndentGuide.activeBackground1': '#3949AB40',
      'editorBracketMatch.background': '#0F766E1A',
      'editorBracketMatch.border': '#0F766E66',
      'editorWhitespace.foreground': '#1B2A4A12',
    },
  });

  monaco.editor.defineTheme('blueprint-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'E2E6ED' },
      { token: 'comment', foreground: '6B7280', fontStyle: 'italic' },
      { token: 'keyword', foreground: '8D9BE8' },
      { token: 'string', foreground: '5CBBAD' },
      { token: 'number', foreground: 'E0A85A' },
      { token: 'type', foreground: 'B396E8' },
      { token: 'delimiter', foreground: '9AA3B2' },
      { token: 'identifier', foreground: 'E2E6ED' },
    ],
    colors: {
      'editor.background': '#171B21',
      'editor.foreground': '#E2E6ED',
      'editorLineNumber.foreground': '#4B515E',
      'editorLineNumber.activeForeground': '#E2E6ED',
      'editorCursor.foreground': '#8D9BE8',
      'editor.selectionBackground': '#8D9BE833',
      'editor.inactiveSelectionBackground': '#8D9BE81F',
      'editor.lineHighlightBackground': '#00000000',
      'editor.lineHighlightBorder': '#00000000',
      'editorIndentGuide.background1': '#E2E6ED12',
      'editorIndentGuide.activeBackground1': '#8D9BE840',
      'editorBracketMatch.background': '#5CBBAD24',
      'editorBracketMatch.border': '#5CBBAD66',
      'editorWhitespace.foreground': '#E2E6ED12',
    },
  });
};

/** Monaco-based code editor with a left-margin "bracket" current-line marker. */
export default function CodeEditor({ value, onChange, currentLine, readOnly }: CodeEditorProps) {
  const { theme } = useTheme();
  const monacoTheme = theme === 'dark' ? 'blueprint-dark' : 'blueprint';
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);

  const handleMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
    monaco.editor.setTheme(monacoTheme);
    decorationsRef.current = ed.createDecorationsCollection();
  };

  // Keep Monaco's theme in sync with the app theme.
  useEffect(() => {
    monacoRef.current?.editor.setTheme(monacoTheme);
  }, [monacoTheme]);

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
          className: 'loopscope-line-content',
          linesDecorationsClassName: 'loopscope-line-bracket',
        },
      },
    ]);
    ed.revealLineInCenterIfOutsideViewport(currentLine);
  }, [currentLine]);

  return (
    <div className="h-full overflow-hidden rounded-draft border border-ink bg-paper2 shadow-draft">
      <Editor
        height="100%"
        defaultLanguage="javascript"
        theme={monacoTheme}
        value={value}
        beforeMount={defineBlueprintThemes}
        onMount={handleMount}
        onChange={(v) => onChange(v ?? '')}
        options={{
          readOnly,
          fontSize: 13,
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontLigatures: false,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbersMinChars: 3,
          glyphMargin: false,
          lineDecorationsWidth: 14,
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: 'none',
          guides: { indentation: true },
          tabSize: 2,
          automaticLayout: true,
          fontWeight: '400',
        }}
      />
    </div>
  );
}

"use client";

import React, { useMemo } from 'react';

interface FileDiffViewerProps {
  diff: string;
  emptyHint?: string;
}

type DiffLineKind = 'add' | 'del' | 'hunk' | 'meta' | 'context';

interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

function classify(line: string): DiffLineKind {
  if (line.startsWith('@@')) return 'hunk';
  if (
    line.startsWith('diff ') ||
    line.startsWith('index ') ||
    line.startsWith('--- ') ||
    line.startsWith('+++ ') ||
    line.startsWith('new file') ||
    line.startsWith('deleted file') ||
    line.startsWith('similarity ') ||
    line.startsWith('rename ')
  ) {
    return 'meta';
  }
  if (line.startsWith('+')) return 'add';
  if (line.startsWith('-')) return 'del';
  return 'context';
}

const KIND_CLASS: Record<DiffLineKind, string> = {
  add: 'bg-green-900/20 text-green-400',
  del: 'bg-red-900/20 text-red-400',
  hunk: 'bg-accent-purple/20 text-accent-purple',
  meta: 'text-text-muted',
  context: 'text-text-secondary',
};

export function FileDiffViewer({ diff, emptyHint }: FileDiffViewerProps) {
  const lines = useMemo<DiffLine[]>(() => {
    if (!diff) return [];
    return diff.split('\n').map((text) => ({ kind: classify(text), text }));
  }, [diff]);

  if (lines.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-text-muted">
        {emptyHint ?? 'No changes'}
      </div>
    );
  }

  return (
    <pre className="m-0 overflow-auto p-0 font-mono text-[12px] leading-relaxed">
      <code className="block">
        {lines.map((line, i) => (
          <span
            key={i}
            className={`block whitespace-pre px-3 ${KIND_CLASS[line.kind]}`}
          >
            {line.text === '' ? ' ' : line.text}
          </span>
        ))}
      </code>
    </pre>
  );
}

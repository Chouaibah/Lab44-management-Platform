import React from 'react';

function InlineMarkdown({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={`b${keyIdx}`}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={`i${keyIdx}`}>{match[3]}</em>);
    }
    lastIndex = regex.lastIndex;
    keyIdx++;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return <>{parts}</>;
}

export function parseBasicMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const isListItem = line.trimStart().startsWith('- ');
    const content = isListItem ? line.trimStart().slice(2) : line;
    if (isListItem) {
      return (
        <li key={`li-${i}`} className="ml-4 list-disc">
          <InlineMarkdown text={content} />
        </li>
      );
    }
    if (line.trim() === '') return <br key={`br-${i}`} />;
    return (
      <span key={`span-${i}`}>
        <InlineMarkdown text={content} />
      </span>
    );
  });
}
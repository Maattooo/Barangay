import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Code,
  Eye
} from 'lucide-react';

export interface RichTextTemplateEditorHandle {
  insertText: (text: string) => void;
  getHTML: () => string;
}

interface RichTextTemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  minHeight?: string;
}

export const RichTextTemplateEditor = forwardRef<
  RichTextTemplateEditorHandle,
  RichTextTemplateEditorProps
>(({ value, onChange, minHeight = '320px' }, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastRangeRef = useRef<Range | null>(null);
  const [isHtmlMode, setIsHtmlMode] = useState(false);

  // Synchronize incoming value into editor innerHTML when value differs
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  // Save selection/cursor location whenever user interacts with editor
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current) {
      const range = sel.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        lastRangeRef.current = range.cloneRange();
      }
    }
  };

  // Restore selection or default to end of editor
  const restoreSelection = () => {
    const sel = window.getSelection();
    if (!sel || !editorRef.current) return;

    if (lastRangeRef.current && editorRef.current.contains(lastRangeRef.current.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(lastRangeRef.current);
    } else {
      editorRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      lastRangeRef.current = range;
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      saveSelection();
      onChange(editorRef.current.innerHTML);
    }
  };

  const exec = (command: string, value: string | undefined = undefined) => {
    if (isHtmlMode) return;
    restoreSelection();
    document.execCommand(command, false, value);
    if (editorRef.current) {
      saveSelection();
      onChange(editorRef.current.innerHTML);
    }
  };

  // Imperative handle to insert text/tag at cursor position
  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      if (isHtmlMode) {
        onChange(value + text);
        return;
      }

      restoreSelection();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !editorRef.current) {
        // Fallback: append at end
        if (editorRef.current) {
          editorRef.current.innerHTML += text;
          onChange(editorRef.current.innerHTML);
        } else {
          onChange(value + text);
        }
        return;
      }

      const range = sel.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);

      // Move cursor right after inserted text
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      sel.removeAllRanges();
      sel.addRange(range);
      lastRangeRef.current = range.cloneRange();

      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    },
    getHTML: () => {
      return editorRef.current ? editorRef.current.innerHTML : value;
    }
  }));

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 transition">
      {/* Formatting Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 border-b border-slate-200 text-slate-700">
        <button
          type="button"
          onClick={() => exec('bold')}
          title="Bold (Ctrl+B)"
          aria-label="Bold"
          className="p-1.5 rounded hover:bg-slate-200 active:bg-slate-300 transition-colors"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('italic')}
          title="Italic (Ctrl+I)"
          aria-label="Italic"
          className="p-1.5 rounded hover:bg-slate-200 active:bg-slate-300 transition-colors"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('underline')}
          title="Underline (Ctrl+U)"
          aria-label="Underline"
          className="p-1.5 rounded hover:bg-slate-200 active:bg-slate-300 transition-colors"
        >
          <Underline className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-300 mx-1" />

        <button
          type="button"
          onClick={() => exec('formatBlock', '<h1>')}
          title="Heading 1"
          aria-label="Heading 1"
          className="p-1.5 rounded hover:bg-slate-200 active:bg-slate-300 transition-colors"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('formatBlock', '<h2>')}
          title="Heading 2"
          aria-label="Heading 2"
          className="p-1.5 rounded hover:bg-slate-200 active:bg-slate-300 transition-colors"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('formatBlock', '<h3>')}
          title="Heading 3"
          aria-label="Heading 3"
          className="p-1.5 rounded hover:bg-slate-200 active:bg-slate-300 transition-colors"
        >
          <Heading3 className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-300 mx-1" />

        <button
          type="button"
          onClick={() => exec('insertUnorderedList')}
          title="Bullet List"
          aria-label="Bullet List"
          className="p-1.5 rounded hover:bg-slate-200 active:bg-slate-300 transition-colors"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('insertOrderedList')}
          title="Numbered List"
          aria-label="Numbered List"
          className="p-1.5 rounded hover:bg-slate-200 active:bg-slate-300 transition-colors"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-300 mx-1" />

        <button
          type="button"
          onClick={() => exec('justifyLeft')}
          title="Align Left"
          aria-label="Align Left"
          className="p-1.5 rounded hover:bg-slate-200 active:bg-slate-300 transition-colors"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('justifyCenter')}
          title="Align Center"
          aria-label="Align Center"
          className="p-1.5 rounded hover:bg-slate-200 active:bg-slate-300 transition-colors"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('justifyRight')}
          title="Align Right"
          aria-label="Align Right"
          className="p-1.5 rounded hover:bg-slate-200 active:bg-slate-300 transition-colors"
        >
          <AlignRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('justifyFull')}
          title="Justify"
          aria-label="Justify"
          className="p-1.5 rounded hover:bg-slate-200 active:bg-slate-300 transition-colors"
        >
          <AlignJustify className="w-4 h-4" />
        </button>

        <div className="flex-1" />

        {/* HTML source toggle */}
        <button
          type="button"
          onClick={() => setIsHtmlMode(!isHtmlMode)}
          title={isHtmlMode ? 'Switch to Rich Text' : 'Switch to HTML Source'}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors ${
            isHtmlMode
              ? 'bg-purple-600 text-white'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          {isHtmlMode ? (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>Visual Editor</span>
            </>
          ) : (
            <>
              <Code className="w-3.5 h-3.5" />
              <span>HTML Source</span>
            </>
          )}
        </button>
      </div>

      {/* Editor Content Area */}
      {isHtmlMode ? (
        <textarea
          aria-label="Certificate Body HTML"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ minHeight }}
          className="w-full p-4 font-mono text-xs text-slate-800 bg-slate-900 text-emerald-400 outline-none resize-y"
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-testid="rich-text-editor"
          aria-label="Certificate Body Rich Text Editor"
          onInput={handleInput}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          onTouchEnd={saveSelection}
          onBlur={saveSelection}
          style={{ minHeight }}
          className="p-5 font-serif text-sm leading-relaxed text-slate-800 outline-none focus:outline-none prose max-w-none"
        />
      )}
    </div>
  );
});

RichTextTemplateEditor.displayName = 'RichTextTemplateEditor';
export default RichTextTemplateEditor;

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
  Eye,
  Undo2,
  Redo2,
  Minus,
  Table,
  Eraser
} from 'lucide-react';

export interface RichTextTemplateEditorHandle {
  insertText: (text: string) => void;
  insertHTML: (htmlSnippet: string) => void;
  getHTML: () => string;
  focus: () => void;
}

interface RichTextTemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  minHeight?: string;
  testId?: string;
  ariaLabel?: string;
  onEditorFocus?: () => void;
  compactToolbar?: boolean;
}

export const RichTextTemplateEditor = forwardRef<
  RichTextTemplateEditorHandle,
  RichTextTemplateEditorProps
>(
  (
    {
      value,
      onChange,
      minHeight = '320px',
      testId = 'rich-text-editor',
      ariaLabel = 'Certificate Body Rich Text Editor',
      onEditorFocus,
      compactToolbar = false
    },
    ref
  ) => {
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

      if (
        lastRangeRef.current &&
        editorRef.current.contains(lastRangeRef.current.commonAncestorContainer)
      ) {
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

    const exec = (command: string, commandValue: string | undefined = undefined) => {
      if (isHtmlMode) return;
      restoreSelection();
      document.execCommand(command, false, commandValue);
      if (editorRef.current) {
        saveSelection();
        onChange(editorRef.current.innerHTML);
      }
    };

    const insertHtmlSnippet = (htmlSnippet: string) => {
      if (isHtmlMode) {
        onChange(value + htmlSnippet);
        return;
      }
      restoreSelection();
      document.execCommand('insertHTML', false, htmlSnippet);
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

        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel.removeAllRanges();
        sel.addRange(range);
        lastRangeRef.current = range.cloneRange();

        if (editorRef.current) {
          onChange(editorRef.current.innerHTML);
        }
      },
      insertHTML: (htmlSnippet: string) => {
        insertHtmlSnippet(htmlSnippet);
      },
      getHTML: () => {
        return editorRef.current ? editorRef.current.innerHTML : value;
      },
      focus: () => {
        editorRef.current?.focus();
      }
    }));

    return (
      <div className="border border-zinc-300 rounded-none overflow-hidden bg-white shadow-none focus-within:border-zinc-900 transition-colors">
        {/* Swiss Architectural Formatting Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 p-1.5 bg-zinc-50 border-b border-zinc-200 text-zinc-700 font-mono">
          {!compactToolbar && (
            <>
              <button
                type="button"
                onClick={() => exec('undo')}
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
                className="p-1.5 rounded-none hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => exec('redo')}
                title="Redo (Ctrl+Y)"
                aria-label="Redo"
                className="p-1.5 rounded-none hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-4 bg-zinc-300 mx-1" />
            </>
          )}

          <button
            type="button"
            onClick={() => exec('bold')}
            title="Bold (Ctrl+B)"
            aria-label="Bold"
            className="p-1.5 rounded-none hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => exec('italic')}
            title="Italic (Ctrl+I)"
            aria-label="Italic"
            className="p-1.5 rounded-none hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => exec('underline')}
            title="Underline (Ctrl+U)"
            aria-label="Underline"
            className="p-1.5 rounded-none hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-zinc-300 mx-1" />

          <button
            type="button"
            onClick={() => exec('formatBlock', '<h1>')}
            title="Heading 1"
            aria-label="Heading 1"
            className="p-1.5 rounded-none hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => exec('formatBlock', '<h2>')}
            title="Heading 2"
            aria-label="Heading 2"
            className="p-1.5 rounded-none hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => exec('formatBlock', '<h3>')}
            title="Heading 3"
            aria-label="Heading 3"
            className="p-1.5 rounded-none hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
          >
            <Heading3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => exec('formatBlock', '<p>')}
            title="Normal Paragraph"
            aria-label="Paragraph"
            className="px-1.5 py-1 text-[10px] font-mono font-bold uppercase rounded-none hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
          >
            ¶
          </button>

          <div className="w-px h-4 bg-zinc-300 mx-1" />

          <button
            type="button"
            onClick={() => exec('justifyLeft')}
            title="Align Left"
            aria-label="Align Left"
            className="p-1.5 rounded-none hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => exec('justifyCenter')}
            title="Align Center"
            aria-label="Align Center"
            className="p-1.5 rounded-none hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => exec('justifyRight')}
            title="Align Right"
            aria-label="Align Right"
            className="p-1.5 rounded-none hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => exec('justifyFull')}
            title="Justify"
            aria-label="Justify"
            className="p-1.5 rounded-none hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
          >
            <AlignJustify className="w-3.5 h-3.5" />
          </button>

          {!compactToolbar && (
            <>
              <div className="w-px h-4 bg-zinc-300 mx-1" />

              <button
                type="button"
                onClick={() => exec('insertUnorderedList')}
                title="Bullet List"
                aria-label="Bullet List"
                className="p-1.5 rounded-none hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => exec('insertOrderedList')}
                title="Numbered List"
                aria-label="Numbered List"
                className="p-1.5 rounded-none hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-4 bg-zinc-300 mx-1" />

              <button
                type="button"
                onClick={() =>
                  insertHtmlSnippet(
                    '<table style="width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px;"><tr><td style="border: 1px solid #27272a; padding: 6px 10px; font-weight: bold; width: 35%;">FIELD LABEL</td><td style="border: 1px solid #27272a; padding: 6px 10px;">Value</td></tr></table>'
                  )
                }
                title="Insert 2-Column Data Row Table"
                aria-label="Insert Table"
                className="p-1.5 rounded-none hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
              >
                <Table className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => exec('insertHorizontalRule')}
                title="Insert Divider Line"
                aria-label="Insert Divider"
                className="p-1.5 rounded-none hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => exec('removeFormat')}
                title="Clear Formatting"
                aria-label="Clear Formatting"
                className="p-1.5 rounded-none hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
              >
                <Eraser className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <div className="flex-1" />

          {/* HTML source toggle */}
          <button
            type="button"
            onClick={() => setIsHtmlMode(!isHtmlMode)}
            title={isHtmlMode ? 'Switch to Rich Text' : 'Switch to HTML Source'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-none text-[11px] font-mono font-semibold uppercase tracking-wider border transition-colors ${
              isHtmlMode
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
            }`}
          >
            {isHtmlMode ? (
              <>
                <Eye className="w-3 h-3" />
                <span>Visual Editor</span>
              </>
            ) : (
              <>
                <Code className="w-3 h-3" />
                <span>HTML Source</span>
              </>
            )}
          </button>
        </div>

        {/* Editor Content Area */}
        {isHtmlMode ? (
          <textarea
            aria-label={`${ariaLabel} HTML`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onEditorFocus}
            style={{ minHeight }}
            className="w-full p-4 font-mono text-xs bg-zinc-950 text-emerald-400 outline-none resize-y"
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-testid={testId}
            aria-label={ariaLabel}
            onInput={handleInput}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onTouchEnd={saveSelection}
            onBlur={saveSelection}
            onFocus={() => {
              saveSelection();
              if (onEditorFocus) onEditorFocus();
            }}
            style={{ minHeight }}
            className="p-5 font-serif text-sm leading-relaxed text-zinc-900 outline-none focus:outline-none prose max-w-none [&_table]:w-full [&_td]:border [&_td]:border-zinc-400 [&_td]:p-1.5"
          />
        )}
      </div>
    );
  }
);

RichTextTemplateEditor.displayName = 'RichTextTemplateEditor';
export default RichTextTemplateEditor;

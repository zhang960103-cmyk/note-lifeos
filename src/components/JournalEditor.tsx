/**
 * 富文本日记编辑器 — TipTap
 * 支持：标题/加粗/斜体/任务列表/无序列表/引用
 * 对标 Day Lab Editor.jsx
 */
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import {
  Bold, Italic, List, ListOrdered, CheckSquare,
  Quote, Heading2, Minus, Undo, Redo
} from "lucide-react";

interface JournalEditorProps {
  content?: string;
  onChange?: (html: string) => void;
  onSave?: (html: string) => void;
  placeholder?: string;
  readonly?: boolean;
}

export default function JournalEditor({
  content = "",
  onChange,
  onSave,
  placeholder = "今天想写什么…（支持 **加粗**、- 列表、[ ] 任务）",
  readonly = false,
}: JournalEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      Underline,
    ],
    content,
    editable: !readonly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none text-foreground leading-relaxed min-h-[120px] px-4 py-3",
      },
    },
  });

  if (!editor) return null;

  const ToolButton = ({ onClick, active, title, children }: any) => (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`p-1.5 rounded-lg transition ${active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
      {children}
    </button>
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {!readonly && (
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border flex-wrap">
          <ToolButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="加粗">
            <Bold size={13} />
          </ToolButton>
          <ToolButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="斜体">
            <Italic size={13} />
          </ToolButton>
          <ToolButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="下划线">
            <Minus size={13} />
          </ToolButton>
          <div className="w-px h-4 bg-border mx-1" />
          <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="标题">
            <Heading2 size={13} />
          </ToolButton>
          <ToolButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="无序列表">
            <List size={13} />
          </ToolButton>
          <ToolButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="有序列表">
            <ListOrdered size={13} />
          </ToolButton>
          <ToolButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} title="任务列表">
            <CheckSquare size={13} />
          </ToolButton>
          <ToolButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="引用">
            <Quote size={13} />
          </ToolButton>
          <div className="flex-1" />
          <ToolButton onClick={() => editor.chain().focus().undo().run()} active={false} title="撤销">
            <Undo size={13} />
          </ToolButton>
          <ToolButton onClick={() => editor.chain().focus().redo().run()} active={false} title="重做">
            <Redo size={13} />
          </ToolButton>
          {onSave && (
            <button
              onMouseDown={e => { e.preventDefault(); onSave(editor.getHTML()); }}
              className="ml-2 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition">
              保存
            </button>
          )}
        </div>
      )}

      {/* Editor content with custom styles */}
      <style>{`
        .tiptap-editor .ProseMirror h1, .tiptap-editor .ProseMirror h2 {
          font-family: 'Noto Serif SC', serif;
          color: hsl(var(--foreground));
          margin: 0.5em 0 0.25em;
        }
        .tiptap-editor .ProseMirror h2 { font-size: 1rem; font-weight: 700; }
        .tiptap-editor .ProseMirror p { margin: 0.25em 0; }
        .tiptap-editor .ProseMirror ul, .tiptap-editor .ProseMirror ol { padding-left: 1.5em; margin: 0.25em 0; }
        .tiptap-editor .ProseMirror li { margin: 0.1em 0; }
        .tiptap-editor .ProseMirror blockquote {
          border-left: 3px solid hsl(var(--primary));
          padding-left: 0.75em;
          color: hsl(var(--muted-foreground));
          margin: 0.5em 0;
        }
        .tiptap-editor .ProseMirror strong { color: hsl(var(--foreground)); font-weight: 600; }
        .tiptap-editor ul[data-type="taskList"] { list-style: none; padding-left: 0; }
        .tiptap-editor ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5em; }
        .tiptap-editor ul[data-type="taskList"] li input[type="checkbox"] {
          margin-top: 0.2em; flex-shrink: 0; accent-color: hsl(var(--primary));
        }
        .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground) / 0.4);
          float: left; height: 0; pointer-events: none;
        }
      `}</style>

      <div className="tiptap-editor">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

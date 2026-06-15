import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, Quote, Code, Link as LinkIcon, Image as ImageIcon,
  Table as TableIcon, Undo, Redo, AlignLeft, AlignCenter, AlignRight, Minus,
  Palette, Highlighter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type Props = {
  value: unknown;
  onChange: (json: unknown) => void;
  placeholder?: string;
};

export function TiptapEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
      Underline, TextStyle, Color, Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noreferrer", target: "_blank" } }),
      Image,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList, TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
      Placeholder.configure({ placeholder: placeholder ?? "Começa a escrever a tua matéria…" }),
    ],
    content: value && Object.keys(value as object).length ? (value as object) : undefined,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getJSON();
    if (JSON.stringify(current) === JSON.stringify(value)) return;
    if (value && Object.keys(value as object).length) {
      editor.commands.setContent(value as object, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="gold-frame rounded-md bg-card">
      <Toolbar editor={editor} />
      <div className="p-6 sm:p-10 min-h-[60vh]">
        <EditorContent editor={editor} className="prose-academic max-w-none" />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean) => active ? "bg-accent/30 text-foreground" : "text-muted-foreground";
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b bg-card/95 backdrop-blur px-2 py-1.5 rounded-t-md">
      <Button size="icon" variant="ghost" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></Button>
      <label className="ml-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md hover:bg-accent/30" title="Cor do texto">
        <Palette className="h-4 w-4 text-muted-foreground" />
        <input type="color" className="sr-only" onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} />
      </label>
      <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md hover:bg-accent/30" title="Destaque">
        <Highlighter className="h-4 w-4 text-muted-foreground" />
        <input type="color" className="sr-only" defaultValue="#fff59d" onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()} />
      </label>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Button size="icon" variant="ghost" className={btn(editor.isActive("heading", { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></Button>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Button size="icon" variant="ghost" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive("taskList"))} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive("codeBlock"))} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code className="h-4 w-4" /></Button>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Button size="icon" variant="ghost" className={btn(editor.isActive({ textAlign: "left" }))} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive({ textAlign: "center" }))} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive({ textAlign: "right" }))} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="h-4 w-4" /></Button>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Button size="icon" variant="ghost" onClick={() => {
        const url = prompt("URL do link");
        if (url) editor.chain().focus().setLink({ href: url }).run();
      }}><LinkIcon className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" onClick={() => {
        const url = prompt("URL da imagem");
        if (url) editor.chain().focus().setImage({ src: url }).run();
      }}><ImageIcon className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Button>
      <div className="ml-auto flex items-center gap-1">
        <Button size="icon" variant="ghost" onClick={() => editor.chain().focus().undo().run()}><Undo className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={() => editor.chain().focus().redo().run()}><Redo className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
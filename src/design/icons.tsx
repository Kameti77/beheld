// ── ICON SYSTEM ──────────────────────────────────────────────
// Every icon in the extension used to be a platform emoji (📁📋📑✂🗂📄🗑✕⚙️←)
// — which renders with a completely different weight, size, and style on
// Windows vs. Mac, so nothing ever looked consistent. This wraps a single
// stroke-icon set (lucide-react — small, tree-shakeable, no CSP/network
// concerns since it's just bundled SVG, same as everything else here) with
// one shared default size/stroke-width so every icon in the product reads
// as belonging to the same family.
import {
  Folder,
  FolderOpen,
  Copy,
  Clipboard,
  Crop,
  FolderSearch,
  FileText,
  Trash2,
  X,
  Check,
  AlertCircle,
  Settings,
  ArrowLeft,
  Library,
  Plus,
  Camera,
  ScanLine,
  Image,
  ChevronDown,
  ChevronRight,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";

const DEFAULT_SIZE = 16;
const DEFAULT_STROKE = 1.75;

function withDefaults(IconComponent: ComponentType<LucideProps>) {
  return function ThemedIcon({ size = DEFAULT_SIZE, strokeWidth = DEFAULT_STROKE, ...rest }: LucideProps) {
    return <IconComponent size={size} strokeWidth={strokeWidth} {...rest} />;
  };
}

export const IconFolder = withDefaults(Folder);
export const IconFolderOpen = withDefaults(FolderOpen);
export const IconCopy = withDefaults(Copy);
export const IconClipboard = withDefaults(Clipboard);
export const IconCrop = withDefaults(Crop);
export const IconBrowse = withDefaults(FolderSearch);
export const IconPdf = withDefaults(FileText);
export const IconTrash = withDefaults(Trash2);
export const IconClose = withDefaults(X);
export const IconCheck = withDefaults(Check);
export const IconError = withDefaults(AlertCircle);
export const IconSettings = withDefaults(Settings);
export const IconBack = withDefaults(ArrowLeft);
export const IconLibrary = withDefaults(Library);
export const IconPlus = withDefaults(Plus);
export const IconCamera = withDefaults(Camera);
export const IconFullPage = withDefaults(ScanLine);
export const IconImage = withDefaults(Image);
export const IconChevronDown = withDefaults(ChevronDown);
export const IconChevronRight = withDefaults(ChevronRight);

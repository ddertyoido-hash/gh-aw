/**
 * Icon name -> lucide icon mapping, so data (nav items, agents, activity) can
 * reference icons by string.
 */
import {
  Bot,
  Code2,
  FileText,
  History,
  Home,
  Image as ImageIcon,
  ListChecks,
  Mail,
  MessageSquare,
  Mic,
  Paperclip,
  PenLine,
  Search,
  Settings2,
  Sparkles,
  Telescope,
  Wand2,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  message: MessageSquare,
  wand: Wand2,
  image: ImageIcon,
  mic: Mic,
  telescope: Telescope,
  robot: Bot,
  history: History,
  settings: Settings2,
  pen: PenLine,
  sparkles: Sparkles,
  code: Code2,
  mail: Mail,
  paperclip: Paperclip,
  list: ListChecks,
  file: FileText,
  search: Search,
}

export function iconFor(name: string | undefined | null): LucideIcon {
  if (!name) return Sparkles
  return ICONS[name] ?? Sparkles
}

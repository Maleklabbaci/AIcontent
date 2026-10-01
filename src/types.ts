export type FormatType = 'story' | 'scroller' | 'square';

export type ContentType = 'carousel' | 'poster' | 'story';

export interface SlideData {
  id: string;
  slideNumber: number;
  tag: string;
  title: string;
  subtitle: string;
  bulletPoints?: string[];
  quote?: string;
  stat?: {
    value: string;
    label: string;
  };
  ctaText?: string;
  image?: string;
  imagePosition?: 'top' | 'center' | 'background' | 'bottom';
  highlightWord?: string;
  cardStyle?: 'minimal' | 'bold' | 'quote' | 'stat';
}

export interface DesignProject {
  id: string;
  title: string;
  format: FormatType;
  contentType: ContentType;
  slides: SlideData[];
  currentSlideIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface BrandKit {
  name: string;
  handle: string;
  logoUrl: string;
  primaryColor: string; // Amber / Orange
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  showLogo: boolean;
  showHandle: boolean;
  showSlideNumber: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  formatTag?: FormatType;
  associatedProject?: DesignProject;
  suggestedPrompts?: string[];
}

export interface Session {
  id: string;
  title: string;
  format: FormatType;
  lastUpdated: string;
  previewText: string;
  isPinned?: boolean;
}

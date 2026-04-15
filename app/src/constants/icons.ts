import {
  LayoutGrid, Music, Volume2, VolumeX, Volume1, SkipBack, Play, SkipForward, Square,
  Maximize, Camera, Presentation, ArrowLeft, ArrowRight, PlaySquare, MonitorX, Monitor,
  Settings, Lock, AppWindow, Folder, Moon, Power, RefreshCcw, Terminal, Mouse, Keyboard,
  Video, Mic, MicOff, Type, Image, Star, Heart, Home, LucideIcon
} from 'lucide-react-native';

export const ICON_MAP: Record<string, LucideIcon> = {
  LayoutGrid, Music, Volume2, VolumeX, Volume1, SkipBack, Play, SkipForward, Square,
  Maximize, Camera, Presentation, ArrowLeft, ArrowRight, PlaySquare, MonitorX, Monitor,
  Settings, Lock, AppWindow, Folder, Moon, Power, RefreshCcw, Terminal, Mouse, Keyboard,
  Video, Mic, MicOff, Type, Image, Star, Heart, Home
};

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);

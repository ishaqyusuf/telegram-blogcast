import { cn } from "@/lib/utils";
import { THEME } from "@/lib/theme";
import { camel } from "@acme/utils";
import { useColorScheme } from "@/hooks/use-color";
import {
  Add01Icon as Plus,
  AlertCircleIcon as AlertCircle,
  ArrowDown01Icon as ChevronDown,
  ArrowLeft01Icon as ArrowLeft,
  ArrowLeft01Icon as ChevronLeft,
  ArrowRight01Icon as ChevronRight,
  ArrowUp01Icon as ArrowUp,
  ArrowUp01Icon as ChevronUp,
  ArrowUpDownIcon as ChevronsUpDown,
  AudioWave01Icon as AudioLines,
  AudioWave02Icon as AudioWaveform,
  BarChartIcon as BarChart2,
  Backward01Icon as SkipBack,
  Bookmark01Icon as Bookmark,
  BookBookmark01Icon as BookMarked,
  BookOpen01Icon as BookOpen,
  BubbleChatIcon as MessageCircle,
  Cancel01Icon as X,
  CheckmarkBadge01Icon as BadgeCheck,
  CheckmarkCircle02Icon as CheckCircle2,
  ClosedCaptionIcon as Captions,
  Clock01Icon as Clock,
  CompassIcon as Compass,
  Copy01Icon as Copy,
  Drag01Icon as GripVertical,
  Download01Icon as Download,
  FavouriteIcon as Heart,
  Edit02Icon as Edit2,
  Edit03Icon as Edit3,
  ViewIcon as Eye,
  ViewOffIcon as EyeOff,
  File02Icon as FileText,
  FilePenIcon as FilePenLine,
  FolderOpenIcon as FolderOpen,
  Forward01Icon as SkipForward,
  HeadphonesIcon as Headphones,
  HardDriveIcon as HardDrive,
  Home01Icon as Home,
  Image01Icon as Image,
  InformationCircleIcon as Info,
  Layers01Icon as Layers,
  LibraryIcon as Library,
  Loading01Icon as Loader,
  LockIcon as Lock,
  Logout01Icon as LogOut,
  LeftToRightListNumberIcon as ListOrdered,
  MailSend01Icon as Send,
  Menu01Icon as Menu,
  Message01Icon as MessageSquare,
  Mic01Icon as Mic,
  MoonIcon as Moon,
  MoreHorizontalIcon as MoreHorizontal,
  MusicNote01Icon as Music,
  MusicNote02Icon as Music2,
  Notification01Icon as Bell,
  PauseIcon as Pause,
  PencilEdit02Icon as PenLine,
  PencilIcon as Pencil,
  PlayCircleIcon,
  PlayIcon as Play,
  PlayListIcon as ListMusic,
  RadioIcon as Radio,
  RefreshIcon as RefreshCw,
  RotateClockwiseIcon as RotateCw,
  RotateLeft01Icon as RotateCcw,
  Search01Icon as Search,
  SearchMinusIcon as SearchX,
  Share01Icon as Share,
  Share02Icon as Share2,
  ShuffleIcon as Shuffle,
  SparklesIcon as Sparkles,
  Sun01Icon as Sun,
  Tick01Icon as Check,
  Timer01Icon as Timer,
  Delete02Icon as Trash2,
  UserIcon as User,
  VolumeHighIcon as Volume2,
  Vynil03Icon as Disc3,
  WifiOff01Icon as WifiOff,
  WorkHistoryIcon as History,
} from "@hugeicons/core-free-icons";
import {
  HugeiconsIcon,
  type HugeiconsProps,
  type IconSvgElement,
} from "@hugeicons/react-native";
import { View } from "react-native";

const iconSizes = {
  sm: 16,
  base: 20,
  md: 24,
  lg: 28,
  xl: 32,
  "2xl": 40,
} as const;

const appIcons = {
  Search,
  Play,
  Pause,
  Heart,
  Bookmark,
  Trash2,
  Trash: Trash2,
  Home,
  House: Home,
  Compass,
  User,
  PenLine,
  Pencil,
  FileText,
  FilePenLine,
  Image,
  MoreHorizontal,
  Share2,
  Share,
  Clock,
  ArrowLeft,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  X,
  Edit3,
  Edit2,
  Headphones,
  RotateCcw,
  RotateCw,
  Volume2,
  BarChart2,
  PlayCircle: PlayCircleIcon,
  Plus,
  History,
  MessageSquare,
  MessageCircle,
  ArrowUpDown: ChevronsUpDown,
  ChevronsUpDown,
  Send,
  Mic,
  FolderOpen,
  BadgeCheck,
  Bell,
  AudioWaveform,
  AudioLines,
  SkipForward,
  SkipBack,
  Sparkles,
  Timer,
  Captions,
  Copy,
  ListMusic,
  Disc3,
  CheckCircle2,
  SearchX,
  Loader,
  GripVertical,
  Music,
  Music2,
  ListOrdered,
  Shuffle,
  Moon,
  Sun,
  Download,
  BookOpen,
  BookMarked,
  RefreshCw,
  WifiOff,
  HardDrive,
  AlertCircle,
  Layers,
  Check,
  Radio,
  Lock,
  Info,
  LogOut,
  Menu,
  Eye,
  EyeOff,
  Library,
} satisfies Record<string, IconSvgElement>;
export type IconKeys = keyof typeof appIcons;

export type IconProps = Omit<HugeiconsProps, "icon"> & {
  name?: IconKeys;
};

function resolveColor(className?: string, colorScheme: "light" | "dark" = "light") {
  const textToken = className
    ?.split(" ")
    .reverse()
    .find((token) => token.startsWith("text-"))
    ?.slice(5);
  const [colorToken, opacityToken] = (textToken || "").split("/");
  const colorKey = colorToken
    ? camel(colorToken.split("-").join(" "))
    : undefined;
  const color = colorKey
    ? THEME[colorScheme][colorKey as keyof typeof THEME.light] ?? colorKey
    : undefined;
  const parsedOpacity = opacityToken ? Number(opacityToken) : undefined;
  const opacity =
    parsedOpacity === undefined || Number.isNaN(parsedOpacity)
      ? undefined
      : parsedOpacity > 1
        ? parsedOpacity / 100
        : parsedOpacity;

  return { color, opacity };
}

function resolveSize(className?: string, size?: string | number) {
  if (typeof size === "number") return size;
  if (typeof size === "string" && !size.startsWith("size-")) {
    return Number(size) || size;
  }

  let sizeToken = className
    ?.split(" ")
    .find((token) => token.startsWith("size-"))
    ?.split("-")[1];

  if (sizeToken?.startsWith("[")) {
    sizeToken = sizeToken.replace(/[\[\]px]/g, "");
  }

  return (
    (sizeToken && (iconSizes as Record<string, number>)[sizeToken]) ||
    (sizeToken ? Number(sizeToken) : undefined) ||
    iconSizes.base
  );
}

function IconImpl({ name = "X", className, size, style, ...props }: IconProps) {
  const { colorScheme } = useColorScheme();
  const icon = appIcons[name] ?? appIcons.X;
  const { color, opacity } = resolveColor(className, colorScheme);
  const otherClasses = className
    ?.split(" ")
    .filter((token) => ["size-", "text-"].every((prefix) => !token.startsWith(prefix)));

  const iconNode = (
    <HugeiconsIcon
      icon={icon}
      className={className}
      size={resolveSize(className, size)}
      color={color}
      style={opacity === undefined ? style : ([style, { opacity }] as any)}
      {...props}
    />
  );

  if (otherClasses?.length) {
    return <View className={cn(otherClasses.join(" "))}>{iconNode}</View>;
  }

  return iconNode;
}

function Icon({ className, size = "size-base", ...props }: IconProps) {
  return (
    <IconImpl
      className={cn("text-foreground", className)}
      size={size}
      {...props}
    />
  );
}

export { Icon, appIcons };

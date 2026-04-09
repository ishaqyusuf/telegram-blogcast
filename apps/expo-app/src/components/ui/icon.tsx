import { cn } from "@/lib/utils";
<<<<<<< HEAD
import type { LucideProps } from "lucide-react-native";
import {
  Search,
  Play,
  Pause,
  Heart,
  Bookmark,
  Trash2,
  Home,
  Compass,
  User,
  PenLine,
  FileText,
  MoreHorizontal,
  Share2,
  Clock,
  ArrowLeft,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  X,
  Image as ImageIcon,
  Share,
  Edit3,
  Headphones,
  RotateCcw,
  RotateCw,
  Volume2,
  BarChart2,
  PlayCircle,
  Edit2,
  Plus,
  History,
  MessageSquare,
  MessageCircle,
  ChevronsUpDown,
  Send,
  Mic,
  FolderOpen,
  BadgeCheck,
  Bell,
  AudioWaveform,
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
  ChevronUp,
  ChevronDown,
  GripVertical,
  Pencil,
  Music2,
  ListOrdered,
  Shuffle,
  Moon,
  Sun,
  Menu,
  Radio,
  Layers,
  // Books feature icons
  Download,
  BookOpen,
  BookMarked,
  RefreshCw,
  WifiOff,
  HardDrive,
  AlertCircle,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { camel } from "@gnd/utils";
=======
>>>>>>> d08ecb5 (Rebrand Expo app config and unify mobile icons)
import { THEME } from "@/lib/theme";
import { camel } from "@gnd/utils";
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
  Tick01Icon as Check,
  Timer01Icon as Timer,
  Trash01Icon as Trash,
  Trash02Icon as Trash2,
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
<<<<<<< HEAD
};
// type T = IconProps['strokeWidth']
function IconImpl({ name, ...props }: IconProps) {
  let IconComponent;
  const { colorScheme } = useColorScheme();
  const [, ...colorChunk] =
    props.className
      ?.split(" ")
      ?.reverse()
      ?.find((a) => a?.startsWith("text-"))
      ?.split("-") || [];
  const color = colorChunk?.length ? camel(colorChunk?.join(" ")) : undefined;

  const _themColor = colorScheme === "dark" ? THEME.dark[color!] : THEME.light[color!];

  props.style = {
    ...(props.style || ({} as any)),
    color: _themColor || color,
  };

  let sizestr = props?.className
    ?.split(" ")
    ?.find((a) => a.startsWith("size-"))
    ?.split("-")?.[1]!;
  if (sizestr?.startsWith("[")) {
    sizestr = sizestr.replace(/[\[\]px]/g, "");
  }
  sizestr = iconSizes[sizestr] || sizestr || iconSizes?.base;

  props.size = +sizestr || props.size;
  if (!IconComponent) IconComponent = appIcons![name!] || appIcons.X;
  const otherClasses = props.className
    ?.split(" ")
    .filter((a) => ["size-", "text-"].every((b) => !a?.startsWith(b)));
  if (otherClasses?.length)
    return (
      <View className={cn(otherClasses.join(" "))}>
        <IconComponent {...props} />
      </View>
    );
  return <IconComponent {...props} />;
}

function Icon({
  // as: IconComponent,
  className,
  size = "size-base",

  ...props
}: IconProps) {
  return (
    <IconImpl
      // as={IconComponent}
      className={cn("text-foreground", className)}
      size={size}
      {...props}
    />
  );
}
// function camel(str?: string) {
//   if (!str) return str;
//   return str.replace(
//     /^([A-Z])|\s(\w)/g,
//     function (match: any, p1: any, p2: any, offset: any) {
//       if (p2) return p2.toUpperCase();
//       return p1.toLowerCase();
//     }
//   );
// }
=======
} as const;
>>>>>>> d08ecb5 (Rebrand Expo app config and unify mobile icons)

const appIcons = {
  Search,
  Play,
  Pause,
  Heart,
  Bookmark,
  Trash2,
  Trash,
  Home,
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
<<<<<<< HEAD
  Moon,
  Sun,
  Menu,
  Radio,
  Layers,
  // Books feature icons
=======
>>>>>>> d08ecb5 (Rebrand Expo app config and unify mobile icons)
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
  ArrowUp,
  Eye,
  EyeOff,
  Library,
} satisfies Record<string, IconSvgElement>;
export type IconKeys = keyof typeof appIcons;

export type IconProps = Omit<HugeiconsProps, "icon"> & {
  name?: IconKeys;
};

function resolveColor(className?: string) {
  const [, ...colorChunk] =
    className
      ?.split(" ")
      .reverse()
      .find((token) => token.startsWith("text-"))
      ?.split("-") || [];

  const colorKey = colorChunk.length ? camel(colorChunk.join(" ")) : undefined;
  return colorKey
    ? THEME.light[colorKey as keyof typeof THEME.light] ?? colorKey
    : undefined;
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
  const icon = appIcons[name] ?? appIcons.X;
  const color = resolveColor(className);
  const otherClasses = className
    ?.split(" ")
    .filter((token) => ["size-", "text-"].every((prefix) => !token.startsWith(prefix)));

  const iconNode = (
    <HugeiconsIcon
      icon={icon}
      className={className}
      size={resolveSize(className, size)}
      color={color}
      style={style}
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

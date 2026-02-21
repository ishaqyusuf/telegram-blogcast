import { cn } from "@/lib/utils";
import type { LucideProps } from "lucide-react-native";
import {
  Search,
  Play,
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
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { camel } from "@gnd/utils";
import { THEME } from "@/lib/theme";
import { View } from "react-native";
export type IconProps = LucideProps & {
  name?: IconKeys;
  // strokeWidth?: number;
  // absoluteStrokeWidth?: boolean;
};
const iconSizes = {
  sm: 16,
  base: 20,
  md: 24,
  lg: 28,
  xl: 32,
  "2xl": 40,
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

  const _themColor = THEME.light[color!];
  // colorScheme === "dark" ? THEME.dark[color!] : THEME.light[color!];

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

const appIcons = {
  Search,
  Play,
  Heart,
  Bookmark,
  Trash2,
  Home,
  Compass,
  User,
  PenLine,
  FileText,
  Image: ImageIcon,
  MoreHorizontal,
  Share2,
  Clock,
  ArrowLeft,
  X,
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
};
export type IconKeys = keyof typeof appIcons;
export { Icon };

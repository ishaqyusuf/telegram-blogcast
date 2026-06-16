import { Icon } from "@/components/ui/icon";

interface SkipIconProps {
  size?: number;
  color?: string;
}

export function SkipBack5Icon({ size = 24, color = "#ffffff" }: SkipIconProps) {
  return <Icon name="Backward5" size={size} color={color} strokeWidth={2} />;
}

export function SkipForward5Icon({ size = 24, color = "#ffffff" }: SkipIconProps) {
  return <Icon name="Forward5" size={size} color={color} strokeWidth={2} />;
}

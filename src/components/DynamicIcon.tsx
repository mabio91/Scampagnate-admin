import { lazy, Suspense, memo } from "react";
import { icons, type LucideIcon } from "lucide-react";

interface DynamicIconProps {
  value: string;
  className?: string;
  size?: number;
}

/**
 * Renders an icon from either:
 * - Lucide library: value starts with "lucide:" (e.g. "lucide:Mountain")
 * - Emoji: plain text/emoji character (e.g. "🏆")
 */
function DynamicIconInner({ value, className = "", size = 20 }: DynamicIconProps) {
  if (!value) return null;

  // Lucide icon
  if (value.startsWith("lucide:")) {
    const iconName = value.replace("lucide:", "") as keyof typeof icons;
    const IconComponent = icons[iconName] as LucideIcon | undefined;

    if (IconComponent) {
      return <IconComponent className={className} size={size} />;
    }
    // Fallback: render the name as text if icon not found
    return <span className={className} style={{ fontSize: size * 0.8 }}>?</span>;
  }

  // Emoji fallback
  return (
    <span className={className} style={{ fontSize: size }} role="img">
      {value}
    </span>
  );
}

const DynamicIcon = memo(DynamicIconInner);
export default DynamicIcon;

const fs = require('fs');
const iconPath = 'C:\\Users\\REGAL COMPUTER\\Desktop\\Scampagnate\\scampagnate\\src\\components\\DynamicIcon.tsx';
const iconContent = `import { memo } from "react";
import { icons, type LucideIcon } from "lucide-react";

interface DynamicIconProps {
  value: string;
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

function DynamicIconInner({ value, className = "", size = 20, style }: DynamicIconProps) {
  if (!value) return null;

  if (value.startsWith("lucide:")) {
    const iconName = value.replace("lucide:", "") as keyof typeof icons;
    const IconComponent = icons[iconName] as LucideIcon | undefined;

    if (IconComponent) {
      return <IconComponent className={className} size={size} style={style} />;
    }
    return <span className={className} style={{ fontSize: size * 0.8, ...style }}>?</span>;
  }

  return (
    <span className={className} style={{ fontSize: size, ...style }} role="img">
      {value}
    </span>
  );
}

const DynamicIcon = memo(DynamicIconInner);
export default DynamicIcon;
`;

fs.writeFileSync(iconPath, iconContent, 'utf8');
const badgePath = 'C:\\Users\\REGAL COMPUTER\\Desktop\\Scampagnate\\scampagnate\\src\\components\\events\\DifficultyBadge.tsx';
let badgeContent = fs.readFileSync(badgePath, 'utf8');
if (!badgeContent.includes('DynamicIcon')) {
  badgeContent = badgeContent.replace(/(import .+lucide-react.+;)/, `$1\nimport DynamicIcon from "@/components/DynamicIcon";`);
}
const oldSpan = `          <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: dbLevel.color_icon || dbLevel.color_primary }} />`;
const newSpan = `          {dbLevel.icon ? (
            <DynamicIcon value={dbLevel.icon} className="h-3.5 w-3.5 shrink-0" size={14} style={{ color: dbLevel.color_icon || dbLevel.color_primary }} />
          ) : (
            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: dbLevel.color_icon || dbLevel.color_primary }} />
          )}`;

badgeContent = badgeContent.replace(oldSpan, newSpan);
fs.writeFileSync(badgePath, badgeContent, 'utf8');

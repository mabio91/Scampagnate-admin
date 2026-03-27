import { useState, useMemo, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { icons } from "lucide-react";
import DynamicIcon from "./DynamicIcon";
import { Search, Smile, Grid3X3 } from "lucide-react";

// ─── Curated Lucide icon set (~300 most relevant for outdoor/sport/community app) ───
const LUCIDE_ICON_NAMES: string[] = [
  // Nature & Outdoor
  "Mountain", "MountainSnow", "Trees", "TreePine", "TreeDeciduous", "Flower", "Flower2",
  "Leaf", "Sprout", "Sun", "Moon", "CloudSun", "Cloud", "CloudRain", "CloudSnow",
  "CloudLightning", "Wind", "Waves", "Droplets", "Snowflake", "Flame", "Sunrise", "Sunset",
  "Rainbow", "Thermometer", "ThermometerSun",
  // Sports & Activity
  "Bike", "Footprints", "PersonStanding", "Tent", "Compass", "Map", "MapPin", "MapPinned",
  "Navigation", "Route", "Signpost", "Flag", "FlagTriangleRight",
  "Timer", "Clock", "Hourglass", "Zap", "Activity", "HeartPulse", "Dumbbell",
  // Awards & Achievement
  "Trophy", "Medal", "Award", "Crown", "Star", "Sparkles", "Sparkle", "Gem",
  "Target", "Goal", "CircleCheckBig", "BadgeCheck", "ShieldCheck", "ThumbsUp",
  // People & Community
  "Users", "User", "UserPlus", "UserCheck", "UsersRound", "HandshakeIcon",
  "Heart", "Handshake", "MessageCircle", "MessageSquare", "Mail", "Bell",
  "PartyPopper", "Gift", "Cake", "Baby",
  // Animals
  "Bird", "Bug", "Cat", "Dog", "Fish", "Rabbit", "Squirrel", "Turtle",
  // Travel & Transport
  "Car", "Bus", "Train", "Plane", "Ship", "Anchor", "Rocket",
  "Luggage", "Ticket", "Globe", "Earth",
  // Food & Drink
  "Coffee", "Wine", "Beer", "UtensilsCrossed", "Pizza", "Apple", "Cherry",
  "Salad", "Sandwich", "IceCreamCone", "CupSoda",
  // Objects & Tools
  "Camera", "Flashlight", "Binoculars", "Telescope", "Backpack",
  "Scissors", "Wrench", "Hammer", "Shovel",
  "Key", "Lock", "LockOpen", "Shield", "ShieldAlert",
  "Bookmark", "BookOpen", "Book", "Newspaper", "FileText",
  "Lightbulb", "Lamp", "Battery", "BatteryFull", "Plug",
  // Music & Entertainment
  "Music", "Music2", "Headphones", "Radio", "Mic", "Guitar",
  "Gamepad2", "Dice1", "Dice5", "Puzzle",
  // Health & Safety
  "Cross", "Stethoscope", "Pill", "Syringe", "Ambulance",
  "AlertTriangle", "AlertCircle", "Info", "CircleHelp",
  // Tech & UI
  "Smartphone", "Laptop", "Monitor", "Wifi", "Bluetooth", "QrCode",
  "Calendar", "CalendarDays", "CalendarCheck", "CalendarClock",
  "ClipboardList", "ClipboardCheck", "ListChecks",
  "Settings", "SlidersHorizontal", "Filter", "Search",
  "Eye", "EyeOff", "Scan", "Fingerprint",
  // Arrows & Symbols
  "ArrowRight", "ArrowUp", "ArrowDown", "ArrowLeft",
  "Check", "X", "Plus", "Minus", "Equal",
  "CirclePlus", "CircleMinus", "CircleX", "CircleCheck",
  "ChevronRight", "ChevronDown", "ChevronUp",
  "MoveRight", "MoveUp", "Repeat", "RefreshCw", "RotateCw",
  // Shapes & Layout
  "Circle", "Square", "Triangle", "Hexagon", "Pentagon", "Octagon",
  "Diamond", "RectangleHorizontal",
  // Building & Places
  "Home", "Building", "Building2", "Church", "Landmark", "Castle",
  "Factory", "Store", "Warehouse", "ParkingCircle",
  // Finance
  "DollarSign", "Euro", "Wallet", "CreditCard", "Receipt",
  "PiggyBank", "Banknote", "Coins", "TrendingUp", "TrendingDown",
  "BarChart3", "PieChart", "LineChart",
  // Communication
  "Phone", "PhoneCall", "Video", "Send", "Share2", "Link", "ExternalLink",
  "Download", "Upload", "Paperclip", "Inbox",
  // Misc
  "Tag", "Tags", "Hash", "AtSign", "Percent",
  "Power", "ToggleLeft", "ToggleRight",
  "Palette", "Paintbrush", "Pen", "PenTool", "Pencil",
  "Trash2", "Archive", "FolderOpen", "Folder",
  "Package", "Box", "Boxes",
];

// Filter to only icons that actually exist in installed lucide-react
const VALID_LUCIDE_ICONS = LUCIDE_ICON_NAMES.filter((name) => name in icons);

// ─── Curated emoji set organized by category ───
const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: "Nature",
    emojis: ["🌲", "🌳", "🌴", "🌵", "🌿", "🍀", "🌺", "🌻", "🌸", "🌹", "🌼", "🍁", "🍂", "🍃", "🌾", "🪵", "🪨", "⛰️", "🏔️", "🗻", "🌋", "🏝️", "🏜️", "🌊", "💧", "❄️", "🔥", "☀️", "🌙", "⭐", "🌈", "🌅", "🌄"],
  },
  {
    name: "Sport",
    emojis: ["⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏓", "🏸", "🏊", "🚴", "🏃", "🧗", "🎿", "🏂", "⛷️", "🤸", "🚣", "🏋️", "🥇", "🥈", "🥉", "🏅", "🎯", "🎣"],
  },
  {
    name: "Awards",
    emojis: ["🏆", "👑", "💎", "⭐", "🌟", "✨", "💫", "🎖️", "🏅", "🥇", "🎯", "💪", "🔥", "🎉", "🎊", "🎈", "🎁", "👏", "🙌", "❤️", "💜", "💙", "💚", "💛"],
  },
  {
    name: "Animals",
    emojis: ["🐕", "🐈", "🐎", "🦅", "🦆", "🦉", "🐿️", "🦊", "🐺", "🐻", "🦌", "🐗", "🐍", "🦎", "🐸", "🐢", "🐟", "🦋", "🐝", "🐞", "🐜", "🕷️", "🦂", "🐾"],
  },
  {
    name: "Travel",
    emojis: ["🚶", "🧭", "🗺️", "🏕️", "⛺", "🏠", "🏰", "⛪", "🌍", "🌎", "🌏", "✈️", "🚂", "🚌", "🚗", "🚲", "⛵", "🚀", "🎒", "📸", "🔦", "🧲", "🔑", "📍"],
  },
  {
    name: "Food",
    emojis: ["☕", "🍵", "🧃", "🍺", "🍷", "🍕", "🍔", "🌮", "🥗", "🍎", "🍊", "🍋", "🍇", "🍓", "🍒", "🥐", "🍰", "🍩", "🍪", "🧁", "🍫", "🌽", "🥕", "🍌"],
  },
  {
    name: "Objects",
    emojis: ["📱", "💻", "📷", "🎵", "🎶", "🎸", "🎮", "🎲", "🧩", "📚", "📖", "📝", "✏️", "🔧", "⚙️", "🔔", "💡", "🕯️", "🧪", "💊", "🩺", "⚠️", "🚨", "🏳️"],
  },
  {
    name: "Symbols",
    emojis: ["✅", "❌", "➕", "➖", "❤️", "💔", "♻️", "🔰", "⚡", "💥", "🌀", "📌", "🔗", "🏷️", "#️⃣", "🔢", "🔤", "📂", "📁", "📊", "📈", "📉", "📋", "🧾"],
  },
];

const ALL_EMOJIS = EMOJI_CATEGORIES.flatMap((c) => c.emojis);

// ─── Component ───
interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function IconPicker({ value, onChange, placeholder = "Scegli icona" }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"icons" | "emoji">("icons");
  const [visibleCount, setVisibleCount] = useState(120);

  // Filter Lucide icons by search
  const filteredIcons = useMemo(() => {
    if (!search.trim()) return VALID_LUCIDE_ICONS.slice(0, visibleCount);
    const q = search.toLowerCase();
    return VALID_LUCIDE_ICONS.filter((name) =>
      name.toLowerCase().includes(q)
    );
  }, [search, visibleCount]);

  // Filter emojis by category name search
  const filteredEmojiCategories = useMemo(() => {
    if (!search.trim()) return EMOJI_CATEGORIES;
    const q = search.toLowerCase();
    return EMOJI_CATEGORIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [search]);

  const handleSelect = useCallback(
    (icon: string) => {
      onChange(icon);
      setOpen(false);
      setSearch("");
      setVisibleCount(120);
    },
    [onChange]
  );

  const showMore = useCallback(() => {
    setVisibleCount((c) => c + 120);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2 h-10 font-normal"
        >
          {value ? (
            <DynamicIcon value={value} size={18} />
          ) : (
            <Grid3X3 className="h-4 w-4 text-muted-foreground" />
          )}
          <span className={value ? "" : "text-muted-foreground"}>
            {value
              ? value.startsWith("lucide:")
                ? value.replace("lucide:", "")
                : value
              : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 pb-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cerca icona..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(120);
              }}
              className="h-8 pl-8 text-sm"
              autoFocus
            />
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
          <TabsList className="w-full rounded-none border-b h-9">
            <TabsTrigger value="icons" className="flex-1 gap-1.5 text-xs h-7">
              <Grid3X3 className="h-3 w-3" /> Icone ({VALID_LUCIDE_ICONS.length})
            </TabsTrigger>
            <TabsTrigger value="emoji" className="flex-1 gap-1.5 text-xs h-7">
              <Smile className="h-3 w-3" /> Emoji
            </TabsTrigger>
          </TabsList>

          {/* ── Lucide Icons Tab ── */}
          <TabsContent value="icons" className="mt-0">
            <ScrollArea className="h-64">
              <div className="p-2">
                {filteredIcons.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Nessuna icona trovata per "{search}"
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-8 gap-1">
                      {filteredIcons.map((name) => {
                        const lucideValue = `lucide:${name}`;
                        const isSelected = value === lucideValue;
                        return (
                          <button
                            key={name}
                            type="button"
                            title={name}
                            onClick={() => handleSelect(lucideValue)}
                            className={`
                              flex items-center justify-center p-2 rounded-md transition-colors
                              hover:bg-accent hover:text-accent-foreground cursor-pointer
                              ${isSelected ? "bg-primary/10 text-primary ring-1 ring-primary/30" : ""}
                            `}
                          >
                            <DynamicIcon value={lucideValue} size={18} />
                          </button>
                        );
                      })}
                    </div>
                    {!search.trim() && visibleCount < VALID_LUCIDE_ICONS.length && (
                      <div className="flex justify-center pt-2 pb-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={showMore}
                        >
                          Mostra altre ({VALID_LUCIDE_ICONS.length - visibleCount} rimanenti)
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── Emoji Tab ── */}
          <TabsContent value="emoji" className="mt-0">
            <ScrollArea className="h-64">
              <div className="p-2 space-y-3">
                {filteredEmojiCategories.map((cat) => (
                  <div key={cat.name}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                      {cat.name}
                    </p>
                    <div className="grid grid-cols-8 gap-1">
                      {cat.emojis.map((emoji, idx) => {
                        const isSelected = value === emoji;
                        return (
                          <button
                            key={`${cat.name}-${idx}`}
                            type="button"
                            onClick={() => handleSelect(emoji)}
                            className={`
                              flex items-center justify-center p-1.5 rounded-md text-lg transition-colors
                              hover:bg-accent cursor-pointer
                              ${isSelected ? "bg-primary/10 ring-1 ring-primary/30" : ""}
                            `}
                          >
                            {emoji}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {filteredEmojiCategories.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Nessuna categoria trovata per "{search}"
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Selected preview bar */}
        {value && (
          <div className="border-t px-3 py-2 flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2 text-xs">
              <DynamicIcon value={value} size={20} />
              <span className="text-muted-foreground">
                {value.startsWith("lucide:") ? value.replace("lucide:", "") : "Emoji"}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-destructive hover:text-destructive"
              onClick={() => handleSelect("")}
            >
              Rimuovi
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

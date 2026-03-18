import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import flagIt from "@/assets/flag-it.png";
import flagEn from "@/assets/flag-en.png";

// Preload both flag images immediately
const preloadIt = new Image();
preloadIt.src = flagIt;
const preloadEn = new Image();
preloadEn.src = flagEn;

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full overflow-hidden p-0 hover:bg-transparent transition-all">
          <img
            src={language === "it" ? flagIt : flagEn}
            alt={language === "it" ? "Italiano" : "English"}
            className="h-6 w-6 object-contain"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[150px]">
        <div
          role="menuitem"
          onClick={() => setLanguage("it")}
          className={`flex items-center gap-2 cursor-pointer px-2 py-1.5 text-sm rounded-sm ${language === "it" ? "font-medium" : ""}`}
        >
          <img src={flagIt} alt="Italiano" className="h-5 w-5 object-contain" />
          Italiano
        </div>
        <div
          role="menuitem"
          onClick={() => setLanguage("en")}
          className={`flex items-center gap-2 cursor-pointer px-2 py-1.5 text-sm rounded-sm ${language === "en" ? "font-medium" : ""}`}
        >
          <img src={flagEn} alt="English" className="h-5 w-5 object-contain" />
          English
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

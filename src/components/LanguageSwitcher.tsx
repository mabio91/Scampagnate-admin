import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import flagIt from "@/assets/flag-it.png";
import flagEn from "@/assets/flag-en.png";

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
        <DropdownMenuItem
          onClick={() => setLanguage("it")}
          className={`flex items-center gap-2 cursor-pointer ${language === "it" ? "bg-accent font-medium" : ""}`}
        >
          <img src={flagIt} alt="Italiano" className="h-5 w-5 object-contain" />
          Italiano
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage("en")}
          className={`flex items-center gap-2 cursor-pointer ${language === "en" ? "bg-accent font-medium" : ""}`}
        >
          <img src={flagEn} alt="English" className="h-5 w-5 object-contain" />
          English
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

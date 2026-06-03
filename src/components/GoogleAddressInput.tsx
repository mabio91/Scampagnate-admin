import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { loadGoogleMapsPlaces } from "@/lib/googleMaps";

type Suggestion = {
  id: string;
  primaryText: string;
  secondaryText?: string;
  fullText: string;
  prediction: any;
};

type Props = Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  onPlaceSelect?: (place: { address: string; name?: string }) => void;
};

const placeDisplayNameText = (displayName: any) => {
  if (typeof displayName === "string") return displayName;
  return displayName?.text;
};

const formatSelectedPlaceAddress = (
  placeName?: string,
  formattedAddress?: string,
  fallback?: string,
) => {
  const cleanName = placeName?.trim();
  const cleanAddress = formattedAddress?.trim();
  const cleanFallback = fallback?.trim();

  if (cleanName && cleanAddress) {
    const normalizedName = cleanName.toLocaleLowerCase("it-IT");
    const normalizedAddress = cleanAddress.toLocaleLowerCase("it-IT");

    if (normalizedAddress === normalizedName || normalizedAddress.startsWith(`${normalizedName},`)) {
      return cleanAddress;
    }

    return `${cleanName}, ${cleanAddress}`;
  }

  return cleanAddress || cleanName || cleanFallback || "";
};

export function GoogleAddressInput({
  value,
  onValueChange,
  onPlaceSelect,
  className,
  placeholder,
  ...props
}: Props) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [sessionToken, setSessionToken] = useState<any>(null);
  const [placesLib, setPlacesLib] = useState<any>(null);
  const requestIdRef = useRef(0);
  const blurTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    loadGoogleMapsPlaces()
      .then(async (loaded) => {
        if (!loaded || !isMounted || !window.google?.maps?.importLibrary) return;
        const lib = await window.google.maps.importLibrary("places");
        if (!isMounted) return;
        setPlacesLib(lib);
        setSessionToken(new lib.AutocompleteSessionToken());
        setIsReady(true);
      })
      .catch(() => {
        if (isMounted) setIsReady(false);
      });

    return () => {
      isMounted = false;
      if (blurTimeoutRef.current) window.clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isReady || !placesLib) return;

    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const { suggestions: nextSuggestions = [] } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken,
          language: "it",
          region: "it",
          includedRegionCodes: ["it"],
        });

        if (currentRequestId !== requestIdRef.current) return;

        const mapped = nextSuggestions
          .map((suggestion: any) => {
            const prediction = suggestion.placePrediction;
            if (!prediction) return null;

            return {
              id: prediction.placeId || prediction.text?.toString() || crypto.randomUUID(),
              primaryText: prediction.structuredFormat?.mainText?.text || prediction.text?.toString() || "",
              secondaryText: prediction.structuredFormat?.secondaryText?.text || "",
              fullText: prediction.text?.toString() || "",
              prediction,
            } satisfies Suggestion;
          })
          .filter(Boolean) as Suggestion[];

        setSuggestions(mapped);
        setIsOpen(mapped.length > 0);
        setActiveIndex(-1);
      } catch {
        if (currentRequestId === requestIdRef.current) {
          setSuggestions([]);
          setIsOpen(false);
        }
      } finally {
        if (currentRequestId === requestIdRef.current) setIsLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [value, isReady, placesLib, sessionToken]);

  const selectSuggestion = async (suggestion: Suggestion) => {
    onValueChange(suggestion.fullText);
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);

    if (!placesLib || !sessionToken) return;

    try {
      const place = suggestion.prediction?.toPlace?.();
      if (place) {
        await place.fetchFields({ fields: ["displayName", "formattedAddress"] });
        const placeName = placeDisplayNameText(place.displayName);
        onPlaceSelect?.({
          address: formatSelectedPlaceAddress(placeName, place.formattedAddress, suggestion.fullText),
          name: placeName,
        });
      } else {
        onPlaceSelect?.({ address: suggestion.fullText });
      }
    } catch {
      onPlaceSelect?.({ address: suggestion.fullText });
    } finally {
      setSessionToken(new placesLib.AutocompleteSessionToken());
    }
  };

  const activeSuggestion = useMemo(
    () => (activeIndex >= 0 ? suggestions[activeIndex] : null),
    [activeIndex, suggestions],
  );

  return (
    <div className="relative">
      <Input
        {...props}
        value={value}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        onChange={(e) => {
          onValueChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        onBlur={() => {
          blurTimeoutRef.current = window.setTimeout(() => setIsOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (!isOpen || suggestions.length === 0) return;

          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((current) => (current + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
          } else if (e.key === "Enter" && activeSuggestion) {
            e.preventDefault();
            void selectSuggestion(activeSuggestion);
          } else if (e.key === "Escape") {
            setIsOpen(false);
          }
        }}
      />

      {isLoading && isReady && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              className={cn(
                "flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm",
                index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                void selectSuggestion(suggestion);
              }}
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block truncate">{suggestion.primaryText}</span>
                {suggestion.secondaryText && (
                  <span className="block truncate text-xs text-muted-foreground">{suggestion.secondaryText}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

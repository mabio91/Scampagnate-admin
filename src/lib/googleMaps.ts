let googleMapsPromise: Promise<void> | null = null;

declare global {
  interface Window {
    google?: any;
  }
}

const GOOGLE_MAPS_SCRIPT_ID = "google-maps-js";

export async function loadGoogleMapsPlaces() {
  if (typeof window === "undefined") return false;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return false;

  if (window.google?.maps?.importLibrary) {
    await window.google.maps.importLibrary("places");
    return true;
  }

  if (!googleMapsPromise) {
    googleMapsPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Failed to load Google Maps script")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = GOOGLE_MAPS_SCRIPT_ID;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&libraries=places&v=weekly`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google Maps script"));
      document.head.appendChild(script);
    });
  }

  await googleMapsPromise;
  await window.google?.maps?.importLibrary?.("places");
  return true;
}

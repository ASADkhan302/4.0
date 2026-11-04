import React from "react";
import { ULM_OFFICIAL_CREST_SRC, ULM_OFFICIAL_CREST_ASSET_PATH, syncAppDesktopAndFaviconIcon } from "./ulmOfficialAssets";

export { ULM_OFFICIAL_CREST_SRC, ULM_OFFICIAL_CREST_ASSET_PATH, syncAppDesktopAndFaviconIcon };
export const ULM_OFFICIAL_CREST_DATA_URI = ULM_OFFICIAL_CREST_SRC;
export const ULM_CREST_URL = ULM_OFFICIAL_CREST_SRC;
export const ULM_CREST_FALLBACK_PATH = ULM_OFFICIAL_CREST_ASSET_PATH;

export const handleCrestFallback = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  const img = e.currentTarget;
  if (img.src !== ULM_CREST_FALLBACK_PATH) {
    img.onerror = null;
    img.src = ULM_CREST_FALLBACK_PATH;
  }
};

export const ULM_CREST_IMG_Props = {
  src: ULM_OFFICIAL_CREST_SRC,
  alt: "University of Lakki Marwat Official Crest",
  draggable: false,
  onError: handleCrestFallback,
};

export const ULM_CREST_IMG_PROPS = ULM_CREST_IMG_Props;

export default ULM_OFFICIAL_CREST_SRC;

/**
 * Official University of Lakki Marwat Crest Brand Module
 * Completely offline - zero external network requests.
 * Uses exact supplied PNG asset (863417491_2133473440593759_7550028921333764276_n.png)
 * preserved at 100% byte-for-byte fidelity.
 */
import { ULM_OFFICIAL_CREST_DATA_URI, ULM_CREST_IMG_Props } from '../../constants/ulmOfficialCrest';
import {
  ULM_IMAGES,
  ulmOfficial2017Png,
  ulmCrestPng,
  ulmCrestLogo4xPng,
  ulmCrestWatermarkPng,
  ulmLibraryLogoPng,
  ulmLibraryWatermarkPng,
  ulmUniversityCrestPng,
  ulmUniversityCrestWatermarkPng,
  coverCppSystemsJpg,
  coverDiscreteMathJpg,
  coverQuantumPhysicsJpg,
} from '../images';

export {
  ULM_OFFICIAL_CREST_DATA_URI,
  ULM_CREST_IMG_Props,
  ULM_IMAGES,
  ulmOfficial2017Png,
  ulmCrestPng,
  ulmCrestLogo4xPng,
  ulmCrestWatermarkPng,
  ulmLibraryLogoPng,
  ulmLibraryWatermarkPng,
  ulmUniversityCrestPng,
  ulmUniversityCrestWatermarkPng,
  coverCppSystemsJpg,
  coverDiscreteMathJpg,
  coverQuantumPhysicsJpg,
};

export const ULM_CREST_SRC = ULM_OFFICIAL_CREST_DATA_URI;
export const ULM_CREST_LOGO_SRC = ULM_OFFICIAL_CREST_DATA_URI;
export const ULM_CREST_WATERMARK_SRC = ULM_OFFICIAL_CREST_DATA_URI;
export const ULM_CREST_LOGO_FILE = ulmOfficial2017Png || ULM_OFFICIAL_CREST_DATA_URI;
export const ULM_CREST_WATERMARK_FILE = ulmOfficial2017Png || ULM_OFFICIAL_CREST_DATA_URI;

// Aliases matching user filenames in src/assets/images
export const ULM_LIBRARY_LOGO_SRC = ULM_OFFICIAL_CREST_DATA_URI;
export const ULM_LIBRARY_WATERMARK_SRC = ULM_OFFICIAL_CREST_DATA_URI;
export const ULM_LIBRARY_LOGO_FILE = ulmLibraryLogoPng || ULM_OFFICIAL_CREST_DATA_URI;
export const ULM_LIBRARY_WATERMARK_FILE = ulmLibraryWatermarkPng || ULM_OFFICIAL_CREST_DATA_URI;

export const ULM_UNIVERSITY_CREST_SRC = ULM_OFFICIAL_CREST_DATA_URI;
export const ULM_UNIVERSITY_CREST_WATERMARK_SRC = ULM_OFFICIAL_CREST_DATA_URI;

export const ULM_CREST_LOGO = ULM_OFFICIAL_CREST_DATA_URI;
export const ULM_CREST_WATERMARK_URI = ULM_OFFICIAL_CREST_DATA_URI;
export default ULM_OFFICIAL_CREST_DATA_URI;

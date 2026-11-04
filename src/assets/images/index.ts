/**
 * University of Lakki Marwat (ULM 2017) Official Image Assets Registry
 * Preserves the exact byte-for-byte uploaded ULM 2017 Crest PNG
 * (863417491_2133473440593759_7550028921333764276_n.png)
 * and bundled academic book cover assets in src/assets/images.
 */
import ulmOfficial2017Png from './863417491_2133473440593759_7550028921333764276_n.png';
import ulmCrestPng from './ulm-crest.png';
import ulmCrestLogo4xPng from './ulm_crest_logo_4x.png';
import ulmCrestWatermarkPng from './ulm_crest_watermark_6pct_4x.png';
import ulmLibraryLogoPng from './ulm_library_logo.png';
import ulmLibraryWatermarkPng from './ulm_library_watermark_6pct.png';
import ulmUniversityCrestPng from './ulm_university_crest.png';
import ulmUniversityCrestWatermarkPng from './ulm_university_crest_watermark_6pct.png';
import coverCppSystemsJpg from './cover_cpp_systems_1790240701989.jpg';
import coverDiscreteMathJpg from './cover_discrete_math_1790240723836.jpg';
import coverQuantumPhysicsJpg from './cover_quantum_physics_1790240735503.jpg';
import { ULM_OFFICIAL_CREST_SRC } from '../../constants/ulmOfficialAssets';

export {
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
  ULM_OFFICIAL_CREST_SRC,
};

export const ULM_IMAGES = {
  official2017Crest: ULM_OFFICIAL_CREST_SRC,
  official2017CrestFile: ulmOfficial2017Png,
  ulmCrestFile: ulmCrestPng,
  ulmCrestLogo4xFile: ulmCrestLogo4xPng,
  ulmCrestWatermarkFile: ulmCrestWatermarkPng,
  ulmLibraryLogoFile: ulmLibraryLogoPng,
  ulmLibraryWatermarkFile: ulmLibraryWatermarkPng,
  ulmUniversityCrestFile: ulmUniversityCrestPng,
  ulmUniversityCrestWatermarkFile: ulmUniversityCrestWatermarkPng,
  bookCovers: {
    cppSystems: coverCppSystemsJpg,
    discreteMath: coverDiscreteMathJpg,
    quantumPhysics: coverQuantumPhysicsJpg,
  },
} as const;

export default ULM_IMAGES;

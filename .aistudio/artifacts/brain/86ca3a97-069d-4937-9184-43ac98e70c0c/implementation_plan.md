# ULM Library v3.0 — Exact Byte-for-Byte ULM 2017 Crest Preservation & Asset Synchronization

This plan locks in your exact uploaded **University of Lakki Marwat (ULM 2017) Crest PNG** (`863417491_2133473440593759_7550028921333764276_n.png` — featuring the four-quadrant gold and purple shield with the open book, crescent and star, camel, and circuit-plant, purple sun rays over mountains, gold wheat wreath, `"UNIVERSITY OF LAKKI MARWAT"`, and `"2017"`) across all asset directories, desktop icons, and code modules **without altering a single byte, pixel, color, or proportion of the image**.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Zero Pixel Modification Guarantee ("Don't Change Any Atom of the Picture")**:
> The uploaded PNG file will be copied as an exact 1:1 raw binary duplicate (`cp`) and encoded directly into Base64 from its raw bytes without any image processing, resizing, cropping, color filtering, or re-compression.

- **Confirmed Decision 1 — 1:1 Unmodified Binary Copy Across All Asset Folders**: Every crest file in the public directory, internal source image directories, and Windows desktop packaging folder will be replaced with an exact byte-for-byte copy of your uploaded `863417491_2133473440593759_7550028921333764276_n.png`, and any AI-generated shield files will be permanently deleted.
- **Confirmed Decision 2 — Uncropped, Unaltered Rendering in UI & ID Cards**: Every logo container in the header, modals, splash screen, full-app background watermark, and CR80 Student/Staff ID cards (both screen and PDF) will render the complete, uncropped image (`object-contain`) with zero CSS color filters (`filter: none`) so every detail—from the top sun rays to the bottom `"2017"` wreath—remains 100% intact.

---

## 1. Overview & Core Concept

- **What It Does**: Replaces every remaining outdated shield graphic in the repository's image folders and code constants with an exact, untouched binary copy of your uploaded ULM 2017 Crest PNG.
- **Target Audience / Persona**: University of Lakki Marwat librarians, staff, and students using the web interface, printed reports, CR80 Library ID cards, and Windows desktop application.
- **Key Value**: Ensures that your exact uploaded official ULM 2017 Crest appears everywhere—untouched and unmodified down to the last pixel—in both online and offline modes.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **App Header, Splash Screen & Modals**: Displays your exact uploaded ULM 2017 Crest inside an unclipped `object-contain` frame with zero cropping of the sun rays or wheat wreath and zero color/contrast filters.
  2. **CR80 Student & Staff Library ID Cards (Screen & PDF)**: Renders your exact uploaded crest in the top-left header and as the centered security watermark on both Front and Back cards.
  3. **Asset Directory & Code Synchronization**: Directly exports the exact uploaded crest and bundled image assets from the internal image asset directory so every module imports the same unmodified image.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Royal Purple & Gold Liquid-Glass workspace that frames the original ULM 2017 Crest without modifying the image itself.
  - *Color Palette & Mood*: Preserves the exact original gold, royal purple, and white pixels of your uploaded PNG at 100% fidelity.
  - *Component Styling & Layout*: Uses `object-contain` without `rounded-full` clipping on the image element itself so the top sun rays and bottom crossed wheat stems are never cut off.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Raw Byte-for-Byte Copying (`cp`) Only**
  - *Chosen Approach*: Copy the raw bytes of the uploaded PNG directly into every target asset slot and generate the Base64 Data URI directly from those exact bytes.
  - *Why*: Guarantees that file size (51,384 bytes), SHA checksum, dimensions, transparency, and every single pixel remain 100% identical to the uploaded picture.
  - *Alternatives Considered*: Any canvas re-encoding, SVG tracing, or thumbnail resizing was rejected because it alters the original image bytes.
- **Decision 2: Non-Destructive Watermark Transparency**
  - *Chosen Approach*: Keep the watermark PNG file itself 100% identical to your uploaded picture (zero pixel alteration to the file), and let the container layer apply gentle visual opacity when used behind text.
  - *Why*: Preserves the exact original image file everywhere on disk while keeping foreground text readable on ID cards and workspace views.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│        Exact Uploaded ULM 2017 Crest PNG (51,384 Bytes — Untouched)        │
│    (4-Quadrant Shield: Book, Crescent-Star, Camel, Circuit-Plant, 2017)    │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │ 1:1 Raw Binary Copy (Zero Alteration)
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│             Synchronized Binary Asset Folders & Code Constants             │
│  • Public Static Icons & Desktop Packager Icons (Exact Binary Copy)        │
│  • Internal Source Image Asset Folders (Exact Binary Copy + Typed Index)   │
│  • Offline Base64 Data URI (Encoded Directly from Raw Unmodified Bytes)    │
└───────┬─────────────────────┬──────────────────────┬───────────────────────┘
        │                     │                      │
        ▼                     ▼                      ▼
┌───────────────────┐ ┌────────────────────┐ ┌───────────────────────────────┐
│  App Shell & UI   │ │  CR80 ID Cards &   │ │   Modals, Reports & Settings  │
│  • Uncropped Logo │ │  PDF Print Engine  │ │   • Welcome & Storage Modals  │
│  • App Watermark  │ │  • Front/Back Crest│ │   • Clearance Certificates    │
│  • Window Favicon │ │  • Exact PNG Bytes │ │   • Bundled Asset Exports     │
└───────────────────┘ └────────────────────┘ └───────────────────────────────┘
```

### Data Model & State
- **Unmodified Binary Assets**: All crest files across the public folder, internal source image directories, and Windows desktop folder hold the exact 51,384-byte uploaded PNG.
- **Typed Image Asset Module**: Exports the unmodified crest and bundled catalog cover images for direct TypeScript consumption across the codebase.

### Interactive Component & State Mapping
- **Uncropped Rendering**: All `<img>` tags rendering the ULM 2017 Crest use `object-contain` with no circular clipping or CSS filters on the image so every ray and leaf of the original picture is displayed faithfully.

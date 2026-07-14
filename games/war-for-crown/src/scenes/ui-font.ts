import atkinsonHyperlegibleUrl from '../assets/fonts/AtkinsonHyperlegible-Regular.ttf';

export const WAR_FOR_CROWN_FONT_FAMILY = 'Atkinson Hyperlegible';

let fontLoadPromise: Promise<void> | null = null;

function requireDocumentFonts(): FontFaceSet {
  if (typeof document === 'undefined' || document.fonts === undefined) {
    throw new Error('War for Crown UI requires document.fonts support.');
  }
  return document.fonts;
}

async function loadFont(): Promise<void> {
  const fontSet = requireDocumentFonts();
  const fontFace = new FontFace(
    WAR_FOR_CROWN_FONT_FAMILY,
    `url(${atkinsonHyperlegibleUrl}) format("truetype")`,
    { style: 'normal', weight: '400' }
  );
  const loadedFont = await fontFace.load();
  fontSet.add(loadedFont);
  await fontSet.load(`400 16px "${WAR_FOR_CROWN_FONT_FAMILY}"`);

  if (!fontSet.check(`400 16px "${WAR_FOR_CROWN_FONT_FAMILY}"`)) {
    throw new Error(`War for Crown UI font ${WAR_FOR_CROWN_FONT_FAMILY} did not load.`);
  }
}

export function loadWarForCrownUiFont(): Promise<void> {
  if (fontLoadPromise === null) {
    fontLoadPromise = loadFont();
  }
  return fontLoadPromise;
}

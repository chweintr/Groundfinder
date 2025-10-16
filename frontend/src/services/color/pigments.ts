import type { Color, ColorBrandDefinition, ColorSet } from './types';
import { ColorType, ColorOpacity } from './types';
import { Rgb } from './space/rgb';
import type { RgbTuple } from './space/rgb';

// Artist's oil paint pigments
// Hex values are approximate - the system will calculate spectral reflectance
const PIGMENT_DATA: Array<{
  id: number;
  name: string;
  hex: string;
  opacity?: ColorOpacity;
}> = [
  // Whites
  { id: 1, name: 'Titanium White', hex: '#FEFEFE', opacity: ColorOpacity.Opaque },
  
  // Yellows
  { id: 10, name: 'Cadmium Lemon', hex: '#FFF44F' },
  { id: 11, name: 'Cadmium Yellow Medium', hex: '#FFEC00' },
  { id: 12, name: 'Yellow Ochre', hex: '#D4AA3B' },
  
  // Oranges & Reds
  { id: 20, name: 'Cadmium Orange', hex: '#FF8C00' },
  { id: 21, name: 'Cadmium Red Light', hex: '#FF3300' },
  { id: 22, name: 'Cadmium Red', hex: '#E30022' },
  { id: 23, name: 'Alizarin Crimson', hex: '#E32636', opacity: ColorOpacity.Transparent },
  { id: 24, name: 'Quinacridone Magenta', hex: '#8E3A59', opacity: ColorOpacity.Transparent },
  { id: 25, name: 'Dianthus Pink', hex: '#FFBCD9' },
  
  // Blues
  { id: 30, name: 'Phthalo Blue', hex: '#000F89', opacity: ColorOpacity.Transparent },
  { id: 31, name: 'Ultramarine Blue', hex: '#4166F5' },
  { id: 32, name: 'Sevres Blue', hex: '#3E76B8' },
  { id: 33, name: 'Cerulean Blue', hex: '#2A52BE' },
  
  // Greens
  { id: 40, name: 'Phthalo Green', hex: '#123524', opacity: ColorOpacity.Transparent },
  { id: 41, name: 'Sap Green', hex: '#507D2A' },
  { id: 42, name: 'Viridian', hex: '#40826D', opacity: ColorOpacity.Transparent },
  { id: 43, name: 'Chromium Oxide Green', hex: '#5E8C5E' },
  
  // Purples
  { id: 50, name: 'Dioxazine Purple', hex: '#3F2A56', opacity: ColorOpacity.Transparent },
  
  // Earth tones
  { id: 60, name: 'Burnt Umber', hex: '#8A3324' },
  { id: 61, name: 'Burnt Sienna', hex: '#E97451' },
  { id: 62, name: 'Raw Umber', hex: '#826644' },
  { id: 63, name: 'Raw Sienna', hex: '#D68A59' },
];

const BRAND_ID = 1;
const BRAND: ColorBrandDefinition = {
  id: BRAND_ID,
  alias: 'artist-oil-paints',
  fullName: 'Artist Oil Paints',
  shortName: 'Artist',
  freeTier: true,
  colorCount: PIGMENT_DATA.length,
};

function hexToRgbTuple(hex: string): RgbTuple {
  const rgb = Rgb.fromHex(hex);
  return rgb.toRgbTuple();
}

// Convert pigment data to Color objects with spectral reflectance
export function buildPigmentSet(): ColorSet {
  const colors: Color[] = PIGMENT_DATA.map((pigment) => {
    const rgb = hexToRgbTuple(pigment.hex);
    const reflectance = Rgb.fromTuple(rgb).toReflectance();
    
    return {
      brand: BRAND_ID,
      id: pigment.id,
      name: pigment.name,
      rgb,
      rho: reflectance.toArray(),
      opacity: pigment.opacity || ColorOpacity.SemiOpaque,
    };
  });

  return {
    name: 'Artist Oil Paint Set',
    type: ColorType.OilPaint,
    brands: new Map([[BRAND_ID, BRAND]]),
    colors,
  };
}

export const DEFAULT_PIGMENT_SET = buildPigmentSet();


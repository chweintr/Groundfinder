interface ColorTheoryVizProps {
  hex: string;
  lab?: number[];
  lch?: number[];
  temperature: string;
}

export function ColorTheoryViz({ hex, lab, lch, temperature }: ColorTheoryVizProps) {
  console.log('ColorTheoryViz received:', { hex, lab, lch, temperature });
  
  // Extract values from LAB/LCH
  const lightness = lab ? lab[0] : (lch ? lch[0] : 50);
  const chroma = lch ? lch[1] : 0;
  const hue = lch ? lch[2] : 0;
  
  console.log('Calculated values:', { lightness, chroma, hue });

  // Convert to educational scales
  const valueScale = Math.round((lightness / 100) * 10); // 1-10 scale
  const saturationScale = Math.round(Math.min((chroma / 50) * 10, 10)); // 1-10 scale (50+ chroma is very saturated)
  
  // Hue name
  const getHueName = (h: number): string => {
    if (h < 30) return "Red-Orange";
    if (h < 60) return "Orange-Yellow";
    if (h < 90) return "Yellow";
    if (h < 120) return "Yellow-Green";
    if (h < 150) return "Green";
    if (h < 180) return "Green-Cyan";
    if (h < 210) return "Cyan-Blue";
    if (h < 240) return "Blue";
    if (h < 270) return "Blue-Violet";
    if (h < 300) return "Violet-Purple";
    if (h < 330) return "Purple-Magenta";
    return "Magenta-Red";
  };

  const hueName = saturationScale < 2 ? "Neutral/Gray" : getHueName(hue);
  
  // Temperature emoji
  const tempEmoji = temperature === 'warm' ? '🔥' : temperature === 'cool' ? '❄️' : '⚖️';

  return (
    <div className="color-theory-viz">
      <h4 className="theory-title">Color Analysis</h4>
      
      {/* Temperature */}
      <div className="theory-row">
        <div className="theory-label">
          {tempEmoji} Temperature
        </div>
        <div className="theory-value">
          <span className="theory-badge" data-temp={temperature}>
            {temperature.charAt(0).toUpperCase() + temperature.slice(1)}
          </span>
        </div>
      </div>

      {/* Hue */}
      <div className="theory-row">
        <div className="theory-label">
          🎨 Hue
        </div>
        <div className="theory-value">
          {hueName} ({Math.round(hue)}°)
        </div>
      </div>
      <div className="theory-bar-container">
        <div className="theory-bar hue-bar">
          <div 
            className="theory-marker"
            style={{ left: `${(hue / 360) * 100}%` }}
          />
        </div>
      </div>

      {/* Value (Lightness) */}
      <div className="theory-row">
        <div className="theory-label">
          ☀️ Value
        </div>
        <div className="theory-value">
          {valueScale}/10 {valueScale <= 3 ? "(Dark)" : valueScale <= 7 ? "(Mid-tone)" : "(Light)"}
        </div>
      </div>
      <div className="theory-bar-container">
        <div className="theory-bar value-bar">
          <div 
            className="theory-marker"
            style={{ left: `${(valueScale / 10) * 100}%` }}
          />
        </div>
        <div className="theory-bar-labels">
          <span>Dark</span>
          <span>Light</span>
        </div>
      </div>

      {/* Saturation */}
      <div className="theory-row">
        <div className="theory-label">
          💧 Saturation
        </div>
        <div className="theory-value">
          {saturationScale}/10 {saturationScale <= 3 ? "(Muted)" : saturationScale <= 7 ? "(Moderate)" : "(Vivid)"}
        </div>
      </div>
      <div className="theory-bar-container">
        <div className="theory-bar saturation-bar" style={{ backgroundColor: hex }}>
          <div 
            className="theory-marker"
            style={{ left: `${(saturationScale / 10) * 100}%` }}
          />
        </div>
        <div className="theory-bar-labels">
          <span>Gray</span>
          <span>Pure</span>
        </div>
      </div>

      <p className="theory-tip">
        💡 <strong>Tip:</strong> Value = how light/dark, Saturation = how pure/gray, Hue = the color family
      </p>
    </div>
  );
}


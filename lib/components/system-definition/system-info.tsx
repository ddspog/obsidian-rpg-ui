import * as React from "react";

interface SystemInfoProps {
  name: string;
  attributes?: string[];
  skillsSource?: string | string[];
  expressionsSource?: string | string[];
  featuresSource?: string | string[];
  spellcastingSource?: string | string[];
}

export function SystemInfo(props: SystemInfoProps): JSX.Element {
  const renderFileReference = (source: string | string[] | undefined, label: string) => {
    if (!source) return null;
    
    const files = Array.isArray(source) ? source : [source];
    
    return (
      <div className="system-info-section">
        <span className="system-info-label">{label}:</span>
        <div className="system-info-files">
          {files.map((file, index) => (
            <span key={index} className="system-info-file">
              📄 {file}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="system-info-container">
      <div className="system-info-header">
        <span className="system-info-icon">⚙️</span>
        <h3 className="system-info-title">{props.name || "RPG System"}</h3>
      </div>
      
      {props.attributes && props.attributes.length > 0 && (
        <div className="system-info-section">
          <span className="system-info-label">Attributes:</span>
          <div className="system-info-attributes">
            {props.attributes.map((attr, index) => (
              <span key={index} className="system-info-attribute">
                {attr}
              </span>
            ))}
          </div>
        </div>
      )}

      {renderFileReference(props.skillsSource, "Skills")}
      {renderFileReference(props.expressionsSource, "Expressions")}
      {renderFileReference(props.featuresSource, "Features")}
      {renderFileReference(props.spellcastingSource, "Spellcasting")}
    </div>
  );
}

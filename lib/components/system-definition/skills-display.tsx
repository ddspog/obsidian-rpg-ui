import * as React from "react";

interface Skill {
  name: string;
  attribute: string;
}

interface SkillsDisplayProps {
  skills: Skill[];
}

export function SkillsDisplay(props: SkillsDisplayProps): JSX.Element {
  // Group skills by attribute
  const skillsByAttribute = props.skills.reduce((acc, skill) => {
    const attr = skill.attribute || "unknown";
    if (!acc[attr]) {
      acc[attr] = [];
    }
    acc[attr].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>);

  return (
    <div className="system-skills-display">
      <div className="system-skills-header">
        <span className="system-skills-icon">🎯</span>
        <h4 className="system-skills-title">Skills Definition</h4>
        <span className="system-skills-count">{props.skills.length} skills</span>
      </div>

      <div className="system-skills-grid">
        {props.skills.map((skill, index) => (
          <div key={index} className="system-skill-card">
            <div className="system-skill-label">{skill.name}</div>
            <div className="system-skill-attribute">{skill.attribute.substring(0, 3).toUpperCase()}</div>
          </div>
        ))}
      </div>

      <div className="system-skills-summary">
        <h5>Skills by Attribute</h5>
        <div className="system-skills-by-attr">
          {Object.entries(skillsByAttribute).map(([attr, skills]) => (
            <div key={attr} className="system-attr-group">
              <strong>{attr}:</strong> {skills.map(s => s.name).join(", ")}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

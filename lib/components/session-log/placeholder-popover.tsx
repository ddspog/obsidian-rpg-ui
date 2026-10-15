import { useState } from "react";
import {
  parseLogTemplate,
  needsUserInput,
  resolveWithContext,
  ResolutionContext,
  ParsedPlaceholder,
} from "../../domains/session-log/template-resolver";
import { SessionFeatureCard } from "../../domains/session-log/card-types";

interface PlaceholderPopoverProps {
  card: SessionFeatureCard;
  entities: string[];
  onResolve: (resolvedText: string) => void;
  onCancel: () => void;
}

export function PlaceholderPopover({ card, entities, onResolve, onCancel }: PlaceholderPopoverProps) {
  const placeholders = parseLogTemplate(card.logTemplate);
  const userInputs = needsUserInput(placeholders);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const p of userInputs) initial[p.kind] = "";
    return initial;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ctx: ResolutionContext = { actor: card.actor, name: card.name, entities };
    const resolved = resolveWithContext(card.logTemplate, ctx, values);
    onResolve(resolved);
  };

  const handleChange = (kind: string, value: string) => {
    setValues((prev) => ({ ...prev, [kind]: value }));
  };

  const allFilled = userInputs.every((p) => values[p.kind]?.trim());

  return (
    <div className="lonelog-placeholder-popover">
      <form onSubmit={handleSubmit} className="placeholder-form">
        {userInputs.map((placeholder) => (
          <PlaceholderField
            key={placeholder.kind}
            placeholder={placeholder}
            value={values[placeholder.kind]}
            entities={entities}
            onChange={(v) => handleChange(placeholder.kind, v)}
          />
        ))}
        <div className="placeholder-buttons">
          <button type="submit" disabled={!allFilled} className="placeholder-submit">
            Append
          </button>
          <button type="button" onClick={onCancel} className="placeholder-cancel">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

interface PlaceholderFieldProps {
  placeholder: ParsedPlaceholder;
  value: string;
  entities: string[];
  onChange: (value: string) => void;
}

function PlaceholderField({ placeholder, value, entities, onChange }: PlaceholderFieldProps) {
  const isTarget = placeholder.kind === "target";

  return (
    <label className="placeholder-field">
      <span className="placeholder-label">{placeholder.kind}</span>
      {isTarget ? (
        <TargetSelector value={value} entities={entities} onChange={onChange} />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${placeholder.kind}...`}
          className="placeholder-input"
        />
      )}
    </label>
  );
}

interface TargetSelectorProps {
  value: string;
  entities: string[];
  onChange: (value: string) => void;
}

function TargetSelector({ value, entities, onChange }: TargetSelectorProps) {
  const [isCustom, setIsCustom] = useState(false);

  if (isCustom || entities.length === 0) {
    return (
      <div className="target-custom-row">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Custom target..."
          className="placeholder-input"
        />
        {entities.length > 0 && (
          <button type="button" className="target-toggle" onClick={() => setIsCustom(false)}>
            List
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="target-select-row">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="placeholder-select">
        <option value="">Select target...</option>
        {entities.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <button type="button" className="target-toggle" onClick={() => setIsCustom(true)}>
        Custom
      </button>
    </div>
  );
}

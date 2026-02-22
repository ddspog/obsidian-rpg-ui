import * as React from "react";

export interface Expression {
  id: string;
  params?: string[];
  formula: string;
}

export interface ExpressionsDisplayProps {
  expressions: Expression[];
}

export function ExpressionsDisplay(props: ExpressionsDisplayProps): JSX.Element {
  return (
    <div className="system-expressions-display">
      <div className="system-expressions-header">
        <span className="system-expressions-icon">🔢</span>
        <h4 className="system-expressions-title">Expressions Definition</h4>
        <span className="system-expressions-count">{props.expressions.length} expressions</span>
      </div>

      <div className="system-expressions-list">
        {props.expressions.map((expr, index) => (
          <div key={index} className="system-expression-card">
            <div className="system-expression-header">
              <code className="system-expression-id">{expr.id}</code>
              {expr.params && expr.params.length > 0 && (
                <span className="system-expression-params">
                  ({expr.params.join(", ")})
                </span>
              )}
            </div>
            <div className="system-expression-formula">
              <code>{expr.formula}</code>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

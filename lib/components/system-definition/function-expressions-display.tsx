import * as React from "react";
import type { ParsedFunction } from "lib/systems/parser/function-expressions";

interface FunctionExpressionsDisplayProps {
  functions: ParsedFunction[];
}

export function FunctionExpressionsDisplay(props: FunctionExpressionsDisplayProps): JSX.Element {
  return (
    <div className="system-expressions-display">
      <div className="system-expressions-header">
        <span className="system-expressions-icon">⚡</span>
        <h4 className="system-expressions-title">Function Expressions</h4>
        <span className="system-expressions-count">{props.functions.length} functions</span>
      </div>

      <div className="system-expressions-list">
        {props.functions.map((fn, index) => {
          const asyncPrefix = fn.isAsync ? "async " : "";
          const thisParam = fn.usesContext ? "this" : "";
          const otherParams = fn.params.join(", ");
          const allParams = [thisParam, otherParams].filter(Boolean).join(", ");
          const signature = `${asyncPrefix}function ${fn.name}(${allParams})`;

          return (
            <div key={index} className="system-expression-card">
              <div className="system-expression-header">
                <code className="system-expression-id">{fn.name}</code>
                {fn.isAsync && (
                  <span className="system-expression-badge system-expression-async">async</span>
                )}
                {fn.usesContext && (
                  <span className="system-expression-badge system-expression-context">ctx</span>
                )}
                {fn.params.length > 0 && (
                  <span className="system-expression-params">
                    ({fn.params.join(", ")})
                  </span>
                )}
              </div>
              <div className="system-expression-formula">
                <code>{signature} {"{"} ... {"}"}</code>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

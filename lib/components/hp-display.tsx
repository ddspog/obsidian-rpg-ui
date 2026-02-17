/**
 * HPDisplay component
 * Displays current/max HP with temporary HP indicator and progress bar
 */

import type { ParsedHealthBlock } from "lib/types";
// No additional imports needed

export interface HPDisplayProps {
	label: string;
	current: number;
	max: number;
	temporary: number;
	healthPercentage: number;
}

export function HPDisplay(props: HPDisplayProps) {
	return (
		<>
			<div className="health-card-header">
				<div className="generic-card-label">{props.label}</div>
				<div className="health-value">
					{props.current}
					<span className="health-max">/ {props.max}</span>
					{props.temporary > 0 && (
						<span className="health-temp">+{props.temporary} temp</span>
					)}
				</div>
			</div>

			<div className="health-progress-container">
				<div
					className="health-progress-bar"
					style={{ width: `${props.healthPercentage}%` }}
				/>
			</div>
		</>
	);
}

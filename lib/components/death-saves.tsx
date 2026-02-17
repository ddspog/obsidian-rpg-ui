/**
 * DeathSaves component
 * Displays death save tracking (successes and failures)
 */

import { Checkbox } from "lib/components/checkbox";

export interface DeathSavesProps {
	successes: number;
	failures: number;
	onToggle: (type: "success" | "failure", index: number) => void;
}

export function DeathSaves(props: DeathSavesProps) {
	const renderDeathSaves = () => {
		const failures = [];
		const successes = [];

		// Render failures (left side)
		for (let i = 0; i < 3; i++) {
			failures.push(
				<Checkbox
					key={`failure-${i}`}
					checked={i < props.failures}
					id={`death-save-failure-${i}`}
					onChange={() => props.onToggle("failure", i)}
					className="death-save-failure"
				/>
			);
		}

		// Render successes (right side)
		for (let i = 0; i < 3; i++) {
			successes.push(
				<Checkbox
					key={`success-${i}`}
					checked={i < props.successes}
					id={`death-save-success-${i}`}
					onChange={() => props.onToggle("success", i)}
					className="death-save-success"
				/>
			);
		}

		return { failures, successes };
	};

	const { failures, successes } = renderDeathSaves();

	return (
		<>
			<div className="health-divider" />
			<div className="death-saves-container">
				<div className="death-saves-tracker">
					<div className="death-saves-failures">{failures}</div>
					<div className="death-saves-skull">💀</div>
					<div className="death-saves-successes">{successes}</div>
				</div>
			</div>
		</>
	);
}

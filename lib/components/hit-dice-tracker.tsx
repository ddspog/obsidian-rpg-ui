/**
 * HitDiceTracker component
 * Manages and displays hit dice with usage tracking
 */

import type { HitDice, HealthState } from "lib/types";
import {
	isSingleHitDiceState,
	isMultiHitDiceState,
} from "lib/domains/healthpoints";
import { Checkbox } from "lib/components/checkbox";

export interface HitDiceTrackerProps {
	hitDice: HitDice[];
	state: HealthState;
	hasSingleHitDice: boolean;
	onToggle: (diceType: string | null, index: number) => void;
}

export function HitDiceTracker(props: HitDiceTrackerProps) {
	const renderHitDice = () => {
		if (!props.hitDice || props.hitDice.length === 0) return null;

		return (
			<div className="hit-dice-list">
				{props.hitDice.map((hd) => {
					// Get the used count based on state structure
					let used: number = 0;

					if (
						props.hasSingleHitDice &&
						isSingleHitDiceState(props.state)
					) {
						// Legacy single dice with number state
						used = props.state.hitdiceUsed;
					} else if (isMultiHitDiceState(props.state)) {
						// Multiple dice or migrated state
						used = props.state.hitdiceUsed[hd.dice] || 0;
					}

					const hitDiceArray = [];
					for (let i = 0; i < hd.value; i++) {
						hitDiceArray.push(
							<Checkbox
								key={`${hd.dice}-${i}`}
								checked={i < used}
								id={`hit-dice-${hd.dice}-${i}`}
								onChange={() =>
									props.onToggle(
										props.hasSingleHitDice
											? null
											: hd.dice,
										i
									)
								}
							/>
						);
					}

					return (
						<div key={hd.dice} className="hit-dice-row">
							<p className="hit-dice-label">
								HIT DICE ({hd.dice})
							</p>
							<div className="hit-dice-boxes">
								{hitDiceArray}
							</div>
						</div>
					);
				})}
			</div>
		);
	};

	return (
		<>
			<div className="health-divider" />
			<div className="hit-dice-container">{renderHitDice()}</div>
		</>
	);
}

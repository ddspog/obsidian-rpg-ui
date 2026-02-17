import type { ParsedHealthBlock } from "lib/types";
import type { HealthState } from "lib/domains/healthpoints";
import { hasSingleHitDice } from "lib/domains/healthpoints";
import { calculateHealthPercentage } from "lib/domains/health-utils";
import { useHealthState } from "lib/hooks/useHealthState";
import { HPDisplay } from "lib/components/hp-display";
import { HPControls } from "lib/components/hp-controls";
import { HitDiceTracker } from "lib/components/hit-dice-tracker";
import { DeathSaves } from "lib/components/death-saves";

export type HealthCardProps = {
	static: ParsedHealthBlock;
	state: HealthState;
	onStateChange: (newState: HealthState) => void;
};

export function HealthCard(props: HealthCardProps) {
	// Ensure health is a number for calculations
	const maxHealth =
		typeof props.static.health === "number" ? props.static.health : 6;

	// Calculate health percentage for progress bar
	const healthPercentage = calculateHealthPercentage(
		props.state.current,
		maxHealth
	);

	// Use custom hook for all state management and event handlers
	const {
		inputValue,
		setInputValue,
		handleHeal,
		handleDamage,
		handleTempHP,
		toggleHitDie,
		toggleDeathSave,
	} = useHealthState(props.state, maxHealth, props.onStateChange);

	return (
		<div className="health-card generic-card">
			<HPDisplay
				label={props.static.label || "Hit Points"}
				current={props.state.current}
				max={maxHealth}
				temporary={props.state.temporary}
				healthPercentage={healthPercentage}
			/>

			<HPControls
				inputValue={inputValue}
				onInputChange={setInputValue}
				onHeal={handleHeal}
				onDamage={handleDamage}
				onTempHP={handleTempHP}
			/>

			{props.static.hitdice && props.static.hitdice.length > 0 && (
				<HitDiceTracker
					hitDice={props.static.hitdice}
					state={props.state}
					hasSingleHitDice={hasSingleHitDice(props.static)}
					onToggle={toggleHitDie}
				/>
			)}

			{props.static.death_saves && props.state.current <= 0 && (
				<DeathSaves
					successes={props.state.deathSaveSuccesses}
					failures={props.state.deathSaveFailures}
					onToggle={toggleDeathSave}
				/>
			)}
		</div>
	);
}

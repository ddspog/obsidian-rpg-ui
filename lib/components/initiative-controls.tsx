/**
 * InitiativeControls component
 * Displays round counter and turn navigation buttons
 */

export interface InitiativeControlsProps {
	round: number;
	onPrev: () => void;
	onNext: () => void;
	onReset: () => void;
}

export function InitiativeControls(props: InitiativeControlsProps) {
	return (
		<div className="initiative-tracker-controls">
			<div className="initiative-round-counter">
				Round: <span className="initiative-round-value">{props.round}</span>
			</div>
			<button
				className="initiative-control-button initiative-prev"
				onClick={props.onPrev}
				aria-label="Previous combatant"
			>
				◀ Prev
			</button>
			<button
				className="initiative-control-button initiative-next"
				onClick={props.onNext}
				aria-label="Next combatant"
			>
				Next ▶
			</button>
			<button
				className="initiative-control-button initiative-reset"
				onClick={props.onReset}
				aria-label="Reset initiative"
			>
				Reset
			</button>
		</div>
	);
}

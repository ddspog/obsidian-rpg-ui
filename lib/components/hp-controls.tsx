/**
 * HPControls component
 * Handles damage, healing, and temporary HP controls
 */

export interface HPControlsProps {
	inputValue: string;
	onInputChange: (value: string) => void;
	onHeal: () => void;
	onDamage: () => void;
	onTempHP: () => void;
}

export function HPControls(props: HPControlsProps) {
	return (
		<div className="health-controls">
			<input
				type="number"
				className="health-input"
				value={props.inputValue}
				onChange={(e) => props.onInputChange(e.target.value)}
				placeholder="0"
				aria-label="Health points"
			/>
			<button
				type="button"
				className="health-button health-heal"
				onClick={props.onHeal}
			>
				Heal
			</button>
			<button
				type="button"
				className="health-button health-damage"
				onClick={props.onDamage}
			>
				Damage
			</button>
			<button
				type="button"
				className="health-button health-temp"
				onClick={props.onTempHP}
			>
				Temp HP
			</button>
		</div>
	);
}

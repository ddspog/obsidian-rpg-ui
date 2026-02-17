/**
 * MonsterHpDisplay component
 * Displays HP for a single monster with damage/heal controls
 */

export interface MonsterHpDisplayProps {
	index: number;
	monsterKey: string;
	monsterLabel: string;
	currentHp: number;
	maxHp: number;
	inputValue: string;
	statusClass: string;
	onInputChange: (value: string) => void;
	onDamage: () => void;
	onHeal: () => void;
}

export function MonsterHpDisplay(props: MonsterHpDisplayProps) {
	return (
		<div key={`${props.index}-${props.monsterKey}`}
			 className="initiative-monster">
			<div className="initiative-monster-header">
				<span
					className={`initiative-monster-name ${props.statusClass}`}
				>
					{props.monsterLabel}
				</span>
				<span className="initiative-monster-hp">
					<span className="initiative-hp-value">
						{props.currentHp}
					</span>
					<span className="initiative-hp-separator">/</span>
					<span className="initiative-hp-max">{props.maxHp}</span>
				</span>
			</div>
			<div className="initiative-monster-actions">
				<input
					type="number"
					className="initiative-hp-input"
					placeholder="0"
					value={props.inputValue}
					onChange={(e) =>
						props.onInputChange(e.target.value)
					}
				/>
				<button
					className="initiative-hp-button initiative-damage"
					onClick={props.onDamage}
					title="Damage"
				>
					−
				</button>
				<button
					className="initiative-hp-button initiative-heal"
					onClick={props.onHeal}
					title="Heal"
				>
					+
				</button>
			</div>
		</div>
	);
}

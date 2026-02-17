/**
 * InitiativeRow component
 * Displays a single combatant row with initiative roll, name, AC, and HP
 */

import type { InitiativeItem } from "lib/types";
import type { InitiativeState } from "lib/domains/initiative";
import {
	getMaxHp,
	itemHashKey,
} from "lib/domains/initiative";
import { MonsterHpDisplay } from "lib/components/monster-hp-display";
import {
	getHealthStatusClass,
} from "lib/domains/initiative-utils";

export interface InitiativeRowProps {
	item: InitiativeItem;
	index: number;
	initiative: number | undefined;
	isActive: boolean;
	state: InitiativeState;
	inputValue: string;
	onInitiativeChange: (value: string) => void;
	onInputChange: (value: string) => void;
	onDamage: (monsterKey: string) => void;
	onHeal: (monsterKey: string) => void;
}

export function InitiativeRow(props: InitiativeRowProps) {
	const hashKey = itemHashKey(props.item);
	const itemHp = props.state.hp[hashKey] || {};
	const hasHp = props.item.hp !== undefined;
	const isGroup =
		hasHp &&
		typeof props.item.hp === "object" &&
		Object.keys(props.item.hp).length > 1;

	const renderInlineHp = () => {
		const monsterKey = Object.keys(itemHp)[0] || "main";
		const maxHp = getMaxHp(props.item);
		const currentHp = itemHp[monsterKey] || 0;
		const statusClass = getHealthStatusClass(currentHp, maxHp);

		return (
			<div className={`initiative-hp-inline ${statusClass}`}>
				<div className="initiative-hp-display">
					<span className="initiative-hp-value">
						{currentHp}
					</span>
					<span className="initiative-hp-separator">/</span>
					<span className="initiative-hp-max">{maxHp}</span>
				</div>
				<div className="initiative-hp-controls">
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
						onClick={() =>
							props.onDamage(monsterKey)
						}
						title="Damage"
					>
						−
					</button>
					<button
						className="initiative-hp-button initiative-heal"
						onClick={() =>
							props.onHeal(monsterKey)
						}
						title="Heal"
					>
						+
					</button>
				</div>
			</div>
		);
	};

	const renderGroupHp = () => {
		return (
			<div className="initiative-group-hp">
				{Object.entries(
					props.item.hp as Record<string, number>
				).map(([key]) => {
					const currentHp =
						itemHp[key] || 0;
					const maxHp = (props.item.hp as Record<string, number>)[key];
					const statusClass =
						getHealthStatusClass(
							currentHp,
							maxHp
						);

					return (
						<MonsterHpDisplay
							key={`${props.index}-${key}`}
							index={props.index}
							monsterKey={key}
							monsterLabel={key}
							currentHp={currentHp}
							maxHp={maxHp}
							inputValue={props.inputValue}
							statusClass={statusClass}
							onInputChange={
								props.onInputChange
							}
							onDamage={() =>
								props.onDamage(key)
							}
							onHeal={() =>
								props.onHeal(key)
							}
						/>
					);
				})}
			</div>
		);
	};

	return (
		<div
			className={`initiative-item ${
				props.isActive
					? "initiative-item-active"
					: ""
			} ${
				isGroup ? "initiative-item-group" : ""
			}`}
		>
			<div className="initiative-item-main">
				<div className="initiative-roll">
					<input
						type="number"
						value={props.initiative || ""}
						onChange={(e) =>
							props.onInitiativeChange(
								e.target.value
							)
						}
						className="initiative-input"
						placeholder="0"
					/>
				</div>
				<div>
					<div className="initiative-name">
						{props.item.link ? (
							<a
								href={props.item.link}
								className="initiative-link"
							>
								{props.item.name}
							</a>
						) : (
							props.item.name
						)}
					</div>
					<div className="initiative-ac">
						AC:{" "}
						<span className="initiative-ac-value">
							{props.item.ac}
						</span>
					</div>
				</div>

				{hasHp && !isGroup && renderInlineHp()}
			</div>

			{isGroup && (
				<>
					<div className="divider"></div>
					<div className="initiative-group-container">
						{renderGroupHp()}
					</div>
				</>
			)}
		</div>
	);
}

import * as React from "react";
import { EntityBlock, FeatureChoiceOption, Markdown } from "rpg-ui-toolkit";

export const choice: EntityBlock<FeatureChoiceOption> = ({ self }) => {
  if (!self.text) return null;
  return <Markdown source={self.text} />;
};

export default choice;

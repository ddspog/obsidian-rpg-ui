import { CreateEntity } from "rpg-ui-toolkit";
import vehicle from "../blocks/stat/vehicle";
import monster from "../blocks/stat/monster";
import category from "../blocks/stat/category";

const stat = CreateEntity(() => ({
  blocks: {
    vehicle,
    monster,
    category,
    group: category,
  },
}));

export default stat;

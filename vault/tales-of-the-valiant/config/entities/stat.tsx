import { CreateEntity } from "rpg-ui-toolkit";
import vehicle from "../blocks/stat/vehicle";
import monster from "../blocks/stat/monster";
import group from "../blocks/stat/group";

const stat = CreateEntity(() => ({
  blocks: {
    vehicle,
    monster,
    group,
  },
}));

export default stat;

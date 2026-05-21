import { CreateEntity } from "rpg-ui-toolkit";
import vehicle from "../blocks/stat/vehicle";

const stat = CreateEntity(() => ({
  blocks: {
    vehicle,
  },
}));

export default stat;

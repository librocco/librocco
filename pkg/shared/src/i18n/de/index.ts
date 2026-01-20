import { extendDictionary } from "../i18n-util";
import { prepareTranslations } from "../utils";
import en from "../en";
import deJson from "./index.json" with { type: "json" };

const de = extendDictionary(en, prepareTranslations(en, deJson));

export default de;

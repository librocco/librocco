import { extendDictionary } from '../i18n-util'
import { removeEmptyStrings } from '../utils'
import en from '../en'
import deJson from './index.json'

const cleanedDe = removeEmptyStrings(deJson)
const de = extendDictionary(en, cleanedDe)

export default de

import { extendDictionary } from '../i18n-util'
import { removeEmptyStrings } from '../utils'
import en from '../en'
import itJson from './index.json'

const cleanedIt = removeEmptyStrings(itJson)
const it = extendDictionary(en, cleanedIt)

export default it

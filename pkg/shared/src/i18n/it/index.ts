import { extendDictionary } from '../i18n-util'
import { prepareTranslations } from '../utils'
import en from '../en'
import itJson from './index.json' assert { type: 'json' }

const it = extendDictionary(en, prepareTranslations(en, itJson))

export default it

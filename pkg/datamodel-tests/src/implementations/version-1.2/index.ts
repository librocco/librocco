import { ImplementationSetup } from '@/types';

import { newDatabase } from './db';
import designDocuments from './designDocuments';

const implementationSetup: ImplementationSetup = {
	newDatabase,
	designDocuments
};

export default implementationSetup;

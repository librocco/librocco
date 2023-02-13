import { ImplementationSetup } from '@/types';

import { newDatabase } from './db';
import designDocuments from './designDocuments';

const implementationSetup: ImplementationSetup = {
	version: 'v1',
	newDatabase,
	designDocuments
};

export default implementationSetup;

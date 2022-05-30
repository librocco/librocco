import type {Config} from '@jest/types';

// Sync object
const config: Config.InitialOptions = {
  verbose: true,
};

// Or async function
export default async (): Promise<Config.InitialOptions> => {
  return {
    ...config
  };
};

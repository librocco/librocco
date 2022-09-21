/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';

export const ingestJSONDir = async <R extends Record<string, any>>(
	dirname: string
): Promise<R[]> => {
	const contents = await new Promise<string[]>((resolve, reject) => {
		fs.readdir(dirname, (err, files) => {
			if (err) {
				return reject(err);
			}
			return resolve(files);
		});
	});

	const jsonFiles = contents.filter((fn) => /.json$/.test(fn));

	return Promise.all(
		jsonFiles.map(
			(fn) =>
				new Promise<R>((resolve, reject) => {
					const fp = path.join(dirname, fn);
					fs.readFile(fp, (err, data) => {
						if (err) {
							return reject(err);
						}

						const parsedData = JSON.parse(data.toString('utf-8'));
						resolve(parsedData);
					});
				})
		)
	);
};

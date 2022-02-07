import path from 'path';
import fs from 'fs/promises';
import { Dirent } from 'fs';

export async function* walk(rootPath: string): AsyncIterableIterator<string> {
	const directories: Dirent[] = await fs.readdir(rootPath, { withFileTypes: true });
	for (const dir of directories) {
		const fullPath = path.resolve(rootPath, dir.name);
		if (dir.isDirectory()) {
			yield* walk(fullPath);
		} else {
			yield fullPath;
		}
	}
}

export async function ensureDir(dirPath: string): Promise<void> {
  return fs.mkdir(dirPath, { recursive: true })
    .then(() => Promise.resolve())
    .catch(err => ['EEXIST'].includes(err.code)
      ? Promise.resolve()
      : Promise.reject(err));
}

export async function initExtras(outPath: string) {
  const srcDummyFile = path.join(__dirname, 'dummy.js');
  const destDummyFile = path.join(getValidationCodePath(outPath), 'dummy.js');
  try {
    await fs.copyFile(srcDummyFile, destDummyFile);
  } catch (err) {
    return Promise.reject(err);
  }
}

export function getSchemasPath(outPath: string) {
	return path.join(outPath, 'generatedSchemas');
}

export function getValidationCodePath(outPath: string) {
  return path.join(outPath, 'validationCode');
}

export function mergeDeep(...objects) {
	const isObject = obj => obj && typeof obj === 'object';
	
	return objects.reduce((prev, obj) => {
	  Object.keys(obj).forEach(key => {
      const pVal = prev[key];
      const oVal = obj[key];
      
      if (Array.isArray(pVal) && Array.isArray(oVal)) {
        prev[key] = pVal.concat(...oVal);
      }
      else if (isObject(pVal) && isObject(oVal)) {
        prev[key] = mergeDeep(pVal, oVal);
      }
      else {
        prev[key] = oVal;
      }
	  });
	  
	  return prev;
	}, {});
}
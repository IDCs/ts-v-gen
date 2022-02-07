import path from 'path';
import { compileExportFile, generateSchema } from './schemaGenerator';
import { AjvHandler } from './toValidation';
import { TO_SCHEMA_FILE_NAME } from './constants';
import { walk, getSchemasPath, getValidationCodePath, ensureDir, initExtras } from './util';

export async function generateSchemas(rootDir: string, outDir: string, tsconfig: string) {
  const fileEntries: string[] = [];
  for await (const iter of walk(rootDir)) {
    if (path.basename(iter) === TO_SCHEMA_FILE_NAME) {
      fileEntries.push(iter);
    }
  }

  if (fileEntries[0] === undefined) {
    throw new Error('unable to find toJSONSchema.ts');
  }
  const data = compileExportFile(fileEntries[0]);
  const relPaths = Object.keys(data);
  return Promise.all(relPaths.map(relPath => {
    const defaultConfig = {
      tsconfig,
      path: path.resolve(path.dirname(fileEntries[0]), relPath) + '.ts',
      encodeRefs: true,
      additionalProperties: true,
      typeValidationDir: outDir,
    };
    return generateSchema(defaultConfig, data[relPath]);
  }))
}

export async function init(srcPath: string, outPath: string, tscPath: string, cb: (err: Error) => void) {
  try {
    console.dir({ srcPath, schemasOut: getSchemasPath(outPath) });
    await ensureDir(getSchemasPath(outPath));
    await ensureDir(getValidationCodePath(srcPath));
    await initExtras(srcPath);
    await generateSchemas(srcPath, outPath, tscPath);
    await AjvHandler.getInstance().genValidationCode(srcPath, outPath);
  } catch (err: any) {
    cb(err);
  }
}

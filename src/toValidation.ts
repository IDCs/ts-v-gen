import Ajv from 'ajv';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import standaloneCode from 'ajv/dist/standalone';

import { ICustomKeyword, ISchemaInstance } from './types/types';
import { SCHEMA_SUFFIX, VALIDATION_FILE_SUFFIX } from './constants';
import { getValidationCodePath, getSchemasPath, walk } from './util';

import { ValidationFileGenerator as VFG } from './tsGenerator';

export class AjvHandler {
  public static getInstance(): AjvHandler {
    if (!this._instance) {
      this._instance = new this();
    }
    return this._instance;
  }

  private static _instance: AjvHandler;
  private static _customKeywords: ICustomKeyword[] = [
    { keyword: 'exported', type: 'array' }
  ]

  private mAjv: Ajv;
  private constructor() {
    this.mAjv = new Ajv({
      strict: 'log',
      code: { source: true },
      allErrors: true,
      verbose: true,
      keywords: AjvHandler._customKeywords,
      removeAdditional: false,
    });
  }

  public async genValidationCode(srcPath: string, outPath: string) {
    const schemas: ISchemaInstance[] = [];
    for await (const iter of walk(getSchemasPath(outPath))) {
      if (iter.endsWith(SCHEMA_SUFFIX)) {
        try {
          const data = await readFile(iter, { encoding: 'utf-8' });
          const schema = JSON.parse(data);
          const refs = Object.keys(schema['definitions']);
          const valModuleFile = path.basename(iter)
            .replace(SCHEMA_SUFFIX, VALIDATION_FILE_SUFFIX);
          const outputPath = path.join(getValidationCodePath(srcPath), valModuleFile);
          schemas.push({ schema, filePath: iter, refs, validateFilePath: outputPath });
        } catch (err) {
          console.error(err);
        }
      }
    }

    const tsCodeGenerator = VFG.getInstance(path.join(getValidationCodePath(srcPath), 'validation.ts'));
    for (const inst of schemas) {
      try {
        const validate = this.mAjv.compile(inst.schema);
        const moduleCode = standaloneCode(this.mAjv, validate);
        // This is one ugly ass hack - but we don't want any references to ajv regardless
        //  of how compartmentalized they supposedly are.
        const filtered = moduleCode.replace(/\"ajv\/[^)]*/gm, '"./dummy"');
        await writeFile(inst.validateFilePath, filtered);
        tsCodeGenerator.addSchema(inst);
      } catch (err) {
        console.error(err);
      }
    }

    tsCodeGenerator.genValidationFile();
  }
}
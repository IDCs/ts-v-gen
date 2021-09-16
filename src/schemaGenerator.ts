import * as tsj from 'ts-json-schema-generator';
import { unlink, writeFile } from 'fs/promises';
import path from 'path';

import ts from 'typescript';

import { SCHEMA_SUFFIX } from './constants';
import { getSchemasPath, mergeDeep } from './util';

import { FunctionTypeFormatter } from './FunctionTypeFormatter'

export function compileExportFile(filePath: string) {
  const program = ts.createProgram([filePath], { allowJs: false });
  const src = program.getSourceFile(filePath) as ts.SourceFile;
  if (src === undefined) {
    throw new Error('Missing source file');
  }

  const exported: { [relPath: string]: string[] } = {};
  ts.forEachChild(src, (node: ts.Node) => {
    let typeNames: string[] = [];
    if (node.kind === ts.SyntaxKind.ExportDeclaration) {
      node.forEachChild((child: ts.Node) => {
        if (child.kind === ts.SyntaxKind.NamedExports) {
          child.forEachChild((namedExport) => {
            typeNames.push((namedExport['name']['escapedText']));
          })
        }

        if (ts.isTokenKind(child.kind) && child['text']) {
          exported[child['text']] = typeNames.length > 0 ? [...typeNames] : ['*'];
          typeNames = [];
        }
      });
    }
  });
  return exported;
}

export async function generateSchema(config: tsj.Config, types: string[]) {
  const program = tsj.createProgram(config);
  const parser = tsj.createParser(program, config);
  const formatter = tsj.createFormatter(config, (fmt, circularReferenceTypeFormatter) => {
    fmt.addTypeFormatter(new FunctionTypeFormatter());
  });
  const generator = new tsj.SchemaGenerator(program, parser, formatter, config);
  const outputPath = schemaOutputPath(config);
  const fullSchema = types.reduce((accum, iter) => {
    const schema = generator.createSchema(iter);
    const definitions = schema['definitions'];
    const refs = !!schema['$ref']
      ? [{ '$ref': schema['$ref'] }]
      : Object.keys(definitions as object).map(def => ({
          '$ref': `#/definitions/${def}`,
      }));
    const formattedSchema = {
      '$schema': schema['$schema'],
      anyOf: refs,
      definitions: schema['definitions'],
    };
    accum = mergeDeep(accum, formattedSchema);
    return accum;
  }, {});
  let schemaData;
  try {
    schemaData = JSON.stringify(fullSchema, undefined, 2);
  } catch (err) {
    throw err;
  }
  
  return unlink(outputPath)
    .catch(err => (err.code === 'ENOENT')
      ? Promise.resolve()
      : Promise.reject(err))
    .then(() => writeFile(schemaOutputPath(config), schemaData));
}

function schemaOutputPath(config: tsj.Config): string {
  const filePath = config.path as string;
  const outputDir = getSchemasPath(config['typeValidationDir']);
  const targetFileName = path.basename(filePath, path.extname(filePath)) + SCHEMA_SUFFIX;
  return path.join(outputDir, targetFileName);
}

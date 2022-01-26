import * as ts from 'typescript';
import { AnySchemaObject, AsyncValidateFunction, KeywordErrorDefinition, JSONType, ValidateFunction } from 'ajv';

export type AnyValidateFunction<T = any> = ValidateFunction<T> | AsyncValidateFunction<T>;
export interface ICustomKeyword {
  keyword: string | string[];
  type?: JSONType | JSONType[];
  schemaType?: JSONType | JSONType[];
  allowUndefined?: boolean;
  $data?: boolean;
  implements?: string[];
  before?: string;
  post?: boolean;
  metaSchema?: AnySchemaObject;
  validateSchema?: AnyValidateFunction;
  dependencies?: string[];
  error?: KeywordErrorDefinition;
  $dataError?: KeywordErrorDefinition;
}

export interface IImportNode {
  importStatement: ts.ImportDeclaration;
  importIdentifier: ts.Identifier;
}

export interface ISchemaInstanceExt extends ISchemaInstance {
  id: string;
  importNode?: IImportNode;
}

export interface ISchemaInstance {
  schema: any;
  filePath: string;
  validateFilePath: string;
  refs: string[];
}

import * as ts from 'typescript';

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

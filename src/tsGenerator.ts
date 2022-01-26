import path from 'path';
import fs from 'fs/promises';
import * as ts from 'typescript';
import { ISchemaInstance, ISchemaInstanceExt } from './types/types';
import * as shortId from 'shortid';

export class ValidationFileGenerator {
  private static id: number = 0;
  public static getId() {
    return ValidationFileGenerator.id++;
  }
  public static getInstance(outputPath: string): ValidationFileGenerator {
    if (!this._instance) {
      this._instance = new this(outputPath);
    }

    if (this._instance.mOutputFilePath !== outputPath) {
      this._instance.mOutputFilePath = outputPath;
    }

    return this._instance;
  }

  private static _instance: ValidationFileGenerator;

  private mOutputFilePath: string;
  private mSchemas: ISchemaInstanceExt[];

  private constructor(outputPath: string) {
    this.mOutputFilePath = outputPath;
    this.mSchemas = [];
  }

  public addSchema(schema: ISchemaInstance) {
    if (schema) {
      const id = shortId.generate().replace(/[^a-zA-Z ]/g, '');
      this.mSchemas.push({ ...schema, id });
    }
  }

  public async genValidationFile() {
    const file = ts.createSourceFile(this.mOutputFilePath, '', ts.ScriptTarget.ESNext, false, ts.ScriptKind.TS);
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    this.genImportNodes();
    const importNodes = this.mSchemas.map(schema => schema.importNode?.importStatement);
    const res = importNodes.map(node => printer.printNode(ts.EmitHint.Unspecified, node as any, file)).join('');
    const functionNodes = this.mSchemas.reduce((accum, iter) => {
      const validationFunctions = this.genValidateFunctionNodes(iter)
        .filter(funcNode => accum.find(funcDecl =>
          // TODO: find a better way to deal with duplicate validation entries.
          // PROBLEM: The schemas we generate will include refs containing any
          //  extended interfaces as well, and add validation functions for them;
          //  which means that if the dev then adds that same interface separately
          //  a duplicate validation function will be created for the same interface.
          funcDecl.name?.escapedText === funcNode.name?.escapedText) === undefined);

      accum = accum.concat(validationFunctions);
      return accum;
    }, [] as ts.FunctionDeclaration[]);
    const res2 = functionNodes.map(node => printer.printNode(ts.EmitHint.Unspecified, node as any, file)).join('');
    await fs.writeFile(this.mOutputFilePath, ''.concat(res, res2), { encoding: 'utf8' });
    // this.compile();
  }

  private genImportNodes() {
    this.mSchemas = this.mSchemas.reduce((accum, iter) => {
      const relPath = path.relative(path.dirname(this.mOutputFilePath), iter.validateFilePath);
      const importTarget = './' + path.join(path.dirname(relPath), path.basename(relPath, path.extname(relPath)));
      const importIdentifier = ts.factory.createIdentifier(`validate${iter.id}`);
      const importStatement: ts.ImportDeclaration = ts.factory.createImportDeclaration(
        undefined,
        undefined,
        ts.factory.createImportClause(false, importIdentifier, undefined),
        ts.factory.createStringLiteral(importTarget),
      );

      accum.push({
        ...iter,
        importNode: {
          importIdentifier,
          importStatement,
        },
      })
      return accum;
    }, [] as ISchemaInstanceExt[]);
  }

  private genValidateFunctionNodes(schema: ISchemaInstanceExt): ts.FunctionDeclaration[] {
    const { factory } = ts;
    const functionDeclarations: ts.FunctionDeclaration[] = schema.refs.reduce((accum, iter) => {
      if (!!schema?.schema['exported'] && !schema?.schema['exported'].includes(iter)) {
        return accum;
      }
      const functionName = factory.createIdentifier(`validate${iter}`);
      const dataIdentifier = factory.createIdentifier('data');
      const dataParameter = factory.createParameterDeclaration(
        /*decorators*/ undefined,
        /*modifiers*/ undefined,
        /*dotDotDotToken*/ undefined,
        dataIdentifier
      );

      const importIdentifier = schema.importNode?.importIdentifier;
      const callExpression = factory.createCallExpression(importIdentifier as any, undefined, [dataIdentifier]);
      const resultIdentifier = factory.createIdentifier('res');
      const resVar = factory.createVariableDeclaration(resultIdentifier, undefined, undefined, callExpression);
      const returnStatement = factory.createReturnStatement(factory.createConditionalExpression(
        factory.createParenthesizedExpression(factory.createBinaryExpression(
          resultIdentifier,
          factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
          factory.createFalse()
        )),
        factory.createToken(ts.SyntaxKind.QuestionToken),
        factory.createPropertyAccessExpression(
          factory.createPropertyAccessExpression(
            factory.createPropertyAccessExpression(
              importIdentifier as any,
              factory.createIdentifier("prototype")
            ),
            factory.createIdentifier("constructor")
          ),
          factory.createIdentifier("errors")
        ),
        factory.createToken(ts.SyntaxKind.ColonToken),
        factory.createArrayLiteralExpression(
          [],
          false
        )
      ));
      
      accum.push(factory.createFunctionDeclaration(
        /*decorators*/ undefined,
        /*modifiers*/ [factory.createToken(ts.SyntaxKind.ExportKeyword)],
        /*asteriskToken*/ undefined,
        functionName,
        /*typeParameters*/ undefined,
        [dataParameter],
        /*returnType*/ factory.createArrayTypeNode(factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)),
        factory.createBlock([factory.createVariableStatement(undefined, [resVar]), returnStatement], /*multiline*/ true),
      ));
      return accum;
    }, [] as ts.FunctionDeclaration[]);
    return functionDeclarations;
  }

  private compile(): void {
    const options = {
      noEmitOnError: true,
      noImplicitAny: false,
      target: ts.ScriptTarget.ES5,
      module: ts.ModuleKind.CommonJS
    };

    const program = ts.createProgram([this.mOutputFilePath], options);
    const emitResult = program.emit();

    const allDiagnostics = ts.getPreEmitDiagnostics(program)
      .concat(emitResult.diagnostics);

    allDiagnostics.forEach(diagnostic => {
      if (diagnostic.file) {
        let { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!);
        let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
        console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
      } else {
        console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
      }
    });
  }
}

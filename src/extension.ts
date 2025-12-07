import * as vscode from 'vscode';

export interface TypeParam {
  name: string;
  bound: string | null;
}

interface ClassInfo {
  name: string;
  typeParams: TypeParam[];
  indentLevel: number;
  startLine: number;
}

export interface FunctionInfo {
  name: string;
  typeParams: TypeParam[];
  params: { name: string; type: string | null }[];
  returnType: string | null;
  line: number;
}

function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function parsePythonFunctions(document: vscode.TextDocument): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  const text = document.getText();
  const lines = text.split('\n');

  const funcDefStart = /^(\s*)(async\s+)?def\s+(\w+)\s*(?:\[([^\]]*)\])?\s*\(/;
  const classDefStart = /^(\s*)class\s+(\w+)\s*(?:\[([^\]]*)\])?/;

  // Track active classes by indent level
  const classStack: ClassInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const indent = getIndentLevel(line);

    // Pop classes no longer in scope based on indentation
    while (classStack.length > 0 && indent <= classStack[classStack.length - 1].indentLevel) {
      classStack.pop();
    }

    // Check for class definition
    const classMatch = line.match(classDefStart);
    if (classMatch) {
      const className = classMatch[2];
      const classTypeParamsStr = classMatch[3] || '';
      const classTypeParams = parseTypeParams(classTypeParamsStr);
      classStack.push({
        name: className,
        typeParams: classTypeParams,
        indentLevel: indent,
        startLine: i
      });
      continue;
    }

    // Check for function definition
    const match = line.match(funcDefStart);
    if (!match) continue;

    const funcIndent = getIndentLevel(line);
    const funcName = match[3];
    const typeParamsStr = match[4] || '';

    let signature = line;
    let j = i;
    let parenDepth = 0;
    let foundColon = false;

    for (let k = 0; k < signature.length; k++) {
      if (signature[k] === '(') parenDepth++;
      else if (signature[k] === ')') parenDepth--;
      else if (signature[k] === ':' && parenDepth === 0) {
        foundColon = true;
        break;
      }
    }

    while (!foundColon && j < lines.length - 1) {
      j++;
      signature += ' ' + lines[j].trim();
      for (let k = 0; k < lines[j].length; k++) {
        if (lines[j][k] === '(') parenDepth++;
        else if (lines[j][k] === ')') parenDepth--;
      }
      if (parenDepth === 0 && signature.includes(':')) {
        foundColon = true;
      }
    }

    // Get class type params if function is inside a class
    let inheritedTypeParams: TypeParam[] = [];
    if (classStack.length > 0) {
      const currentClass = classStack[classStack.length - 1];
      if (funcIndent > currentClass.indentLevel) {
        inheritedTypeParams = currentClass.typeParams;
      }
    }

    const parsed = parseSignature(signature, funcName, typeParamsStr, inheritedTypeParams);
    if (parsed) {
      functions.push({ ...parsed, line: i });
    }
  }

  return functions;
}

function parseTypeParams(typeParamsStr: string): TypeParam[] {
  if (!typeParamsStr.trim()) return [];

  const typeParams: TypeParam[] = [];
  const parts = splitTypeArgs(typeParamsStr);

  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx !== -1) {
      const name = part.substring(0, colonIdx).trim();
      const bound = part.substring(colonIdx + 1).trim();
      typeParams.push({ name, bound });
    } else {
      typeParams.push({ name: part.trim(), bound: null });
    }
  }

  return typeParams;
}

function parseSignature(
  signature: string,
  funcName: string,
  typeParamsStr: string,
  inheritedTypeParams: TypeParam[]
): Omit<FunctionInfo, 'line'> | null {
  const paramsMatch = signature.match(/def\s+\w+\s*(?:\[[^\]]*\])?\s*\(([^)]*(?:\([^)]*\)[^)]*)*)\)/s);
  if (!paramsMatch) return null;

  const paramsStr = paramsMatch[1];
  const params = parseParams(paramsStr);
  const funcTypeParams = parseTypeParams(typeParamsStr);

  // Merge inherited class type params with function type params
  // Function params take precedence in name collision
  const funcParamNames = new Set(funcTypeParams.map(tp => tp.name));
  const mergedTypeParams = [
    ...inheritedTypeParams.filter(tp => !funcParamNames.has(tp.name)),
    ...funcTypeParams
  ];

  let returnType: string | null = null;
  const returnMatch = signature.match(/\)\s*->\s*([^:]+):/);
  if (returnMatch) {
    returnType = returnMatch[1].trim();
  }

  return { name: funcName, typeParams: mergedTypeParams, params, returnType };
}

function parseParams(paramsStr: string): { name: string; type: string | null }[] {
  const params: { name: string; type: string | null }[] = [];
  if (!paramsStr.trim()) return params;

  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of paramsStr) {
    if (char === '(' || char === '[' || char === '{') {
      depth++;
      current += char;
    } else if (char === ')' || char === ']' || char === '}') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }

  for (const part of parts) {
    // Skip bare * and / (positional-only/keyword-only separators)
    if (part === '*' || part === '/') {
      continue;
    }

    let workingPart = part;
    let isVarArgs = false;
    let isKwArgs = false;

    // Handle **kwargs
    if (workingPart.startsWith('**')) {
      isKwArgs = true;
      workingPart = workingPart.substring(2);
    }
    // Handle *args
    else if (workingPart.startsWith('*')) {
      isVarArgs = true;
      workingPart = workingPart.substring(1);
    }

    const colonIdx = workingPart.indexOf(':');
    const eqIdx = workingPart.indexOf('=');

    let name: string;
    let type: string | null = null;

    if (colonIdx !== -1) {
      name = workingPart.substring(0, colonIdx).trim();
      if (eqIdx !== -1 && eqIdx > colonIdx) {
        type = workingPart.substring(colonIdx + 1, eqIdx).trim();
      } else {
        type = workingPart.substring(colonIdx + 1).trim();
      }
    } else if (eqIdx !== -1) {
      name = workingPart.substring(0, eqIdx).trim();
    } else {
      name = workingPart.trim();
    }

    if (name === 'self' || name === 'cls') {
      continue;
    }

    // For *args: T, represent as *T
    // For **kwargs: T, represent as **T
    if (isVarArgs && type) {
      type = `*${type}`;
    } else if (isKwArgs && type) {
      type = `**${type}`;
    }

    params.push({ name, type });
  }

  return params;
}

function parseGenericType(type: string): { name: string; args: string } | null {
  const bracketIdx = type.indexOf('[');
  if (bracketIdx === -1) return null;

  const name = type.substring(0, bracketIdx);
  // Find matching closing bracket
  let depth = 0;
  let endIdx = -1;
  for (let i = bracketIdx; i < type.length; i++) {
    if (type[i] === '[') depth++;
    else if (type[i] === ']') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  if (endIdx === -1 || endIdx !== type.length - 1) return null;

  const args = type.substring(bracketIdx + 1, endIdx);
  return { name, args };
}

function transformType(type: string): string {
  type = type.trim();

  // Strip quotes from forward references
  if ((type.startsWith('"') && type.endsWith('"')) ||
      (type.startsWith("'") && type.endsWith("'"))) {
    type = type.slice(1, -1);
  }

  // Handle Optional[A] -> A?
  const optionalMatch = type.match(/^Optional\[(.+)\]$/);
  if (optionalMatch) {
    const inner = transformType(optionalMatch[1]);
    return `${inner}?`;
  }

  // Handle A | None -> A? (or (A | B)? if multiple unions)
  const unionNoneMatch = type.match(/^(.+)\s*\|\s*None$/);
  if (unionNoneMatch) {
    const inner = transformType(unionNoneMatch[1]);
    // Wrap in parens if inner contains union to clarify precedence
    if (inner.includes('|')) {
      return `(${inner})?`;
    }
    return `${inner}?`;
  }

  // Handle None | A -> A?
  const noneUnionMatch = type.match(/^None\s*\|\s*(.+)$/);
  if (noneUnionMatch) {
    const inner = transformType(noneUnionMatch[1]);
    if (inner.includes('|')) {
      return `(${inner})?`;
    }
    return `${inner}?`;
  }

  const parsed = parseGenericType(type);
  if (!parsed) return type;

  const { name, args } = parsed;
  const nameLower = name.toLowerCase();

  // Handle tuple[A, B, ...] -> (A, B, ...)
  if (nameLower === 'tuple') {
    const inner = transformTypeList(args);
    return `(${inner})`;
  }

  // Handle list[A] -> [A]
  if (nameLower === 'list') {
    const inner = transformType(args);
    return `[${inner}]`;
  }

  // Handle dict[K, V] -> {K: V}
  if (nameLower === 'dict') {
    const parts = splitTypeArgs(args);
    if (parts.length === 2) {
      return `{${transformType(parts[0])}: ${transformType(parts[1])}}`;
    }
  }

  // Handle set[A] -> {A}
  if (nameLower === 'set') {
    const inner = transformType(args);
    return `{${inner}}`;
  }

  // Handle Callable[[A, B], R] -> (A -> B -> R)
  if (name === 'Callable') {
    // Parse the inner [[args], return] structure
    // Find the inner brackets for args
    if (args.startsWith('[')) {
      let depth = 0;
      let argsEndIdx = -1;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '[') depth++;
        else if (args[i] === ']') {
          depth--;
          if (depth === 0) {
            argsEndIdx = i;
            break;
          }
        }
      }
      if (argsEndIdx !== -1) {
        const callableArgs = args.substring(1, argsEndIdx);
        // Find the return type after the comma
        const rest = args.substring(argsEndIdx + 1).trim();
        if (rest.startsWith(',')) {
          const returnTypeStr = rest.substring(1).trim();
          const returnType = transformType(returnTypeStr);
          if (!callableArgs.trim()) {
            // No args callable: Callable[[], T] -> (() -> T)
            return `(() -> ${returnType})`;
          }
          const argTypes = splitTypeArgs(callableArgs).map(transformType);
          return `(${[...argTypes, returnType].join(' -> ')})`;
        }
      }
    }
  }

  // For other generic types, keep original notation
  return type;
}

function splitTypeArgs(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of argsStr) {
    if (char === '[' || char === '(' || char === '{') {
      depth++;
      current += char;
    } else if (char === ']' || char === ')' || char === '}') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

function transformTypeList(argsStr: string): string {
  return splitTypeArgs(argsStr).map(transformType).join(', ');
}

function isTypeParamUsed(typeParamName: string, types: (string | null)[]): boolean {
  // Check if a type parameter name appears in any of the type strings
  const pattern = new RegExp(`\\b${typeParamName}\\b`);
  return types.some(t => t !== null && pattern.test(t));
}

function formatHaskellSignature(func: FunctionInfo): string {
  const paramTypes = func.params.map(p => p.type ? transformType(p.type) : '?');
  const returnType = func.returnType ? transformType(func.returnType) : '?';

  // Collect all raw types (before transformation) to check for type param usage
  const rawTypes = [
    ...func.params.map(p => p.type),
    func.returnType
  ];

  // Build constraints from bounded type parameters that are actually used
  const constraints = func.typeParams
    .filter(tp => tp.bound !== null && isTypeParamUsed(tp.name, rawTypes))
    .map(tp => `${tp.name}: ${transformType(tp.bound!)}`);

  const constraintStr = constraints.length > 0
    ? `(${constraints.join(', ')}) => `
    : '';

  if (paramTypes.length === 0) {
    return `${func.name} :: ${constraintStr}${returnType}`;
  }

  return `${func.name} :: ${constraintStr}${[...paramTypes, returnType].join(' -> ')}`;
}

class HaskellSigCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  constructor() {
    vscode.workspace.onDidChangeConfiguration(_ => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const config = vscode.workspace.getConfiguration('pythonSignatureLens');
    if (!config.get('enabled', true)) {
      return [];
    }

    const functions = parsePythonFunctions(document);
    const codeLenses: vscode.CodeLens[] = [];

    for (const func of functions) {
      const range = new vscode.Range(func.line, 0, func.line, 0);
      const signature = formatHaskellSignature(func);

      const codeLens = new vscode.CodeLens(range, {
        title: signature,
        command: '',
        arguments: []
      });

      codeLenses.push(codeLens);
    }

    return codeLenses;
  }
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new HaskellSigCodeLensProvider();

  const disposable = vscode.languages.registerCodeLensProvider(
    { language: 'python', scheme: 'file' },
    provider
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}

// Exports for testing
export {
  transformType,
  parseParams,
  parseTypeParams,
  splitTypeArgs,
  formatHaskellSignature
};

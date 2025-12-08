import * as assert from 'assert';
import {
  transformType,
  parseParams,
  parseTypeParams,
  splitTypeArgs,
  formatHaskellSignature,
  parseFunctionsFromText,
  FunctionInfo,
  TransformOptions
} from '../extension';

suite('transformType', () => {
  test('basic types unchanged', () => {
    assert.strictEqual(transformType('int'), 'int');
    assert.strictEqual(transformType('str'), 'str');
    assert.strictEqual(transformType('bool'), 'bool');
    assert.strictEqual(transformType('float'), 'float');
  });

  test('Optional[T] -> T?', () => {
    assert.strictEqual(transformType('Optional[int]'), 'int?');
    assert.strictEqual(transformType('Optional[str]'), 'str?');
  });

  test('T | None -> T?', () => {
    assert.strictEqual(transformType('int | None'), 'int?');
    assert.strictEqual(transformType('str | None'), 'str?');
  });

  test('None | T -> T?', () => {
    assert.strictEqual(transformType('None | int'), 'int?');
    assert.strictEqual(transformType('None | str'), 'str?');
  });

  test('list[T] -> [T]', () => {
    assert.strictEqual(transformType('list[int]'), '[int]');
    assert.strictEqual(transformType('list[str]'), '[str]');
  });

  test('dict[K, V] -> {K: V}', () => {
    assert.strictEqual(transformType('dict[str, int]'), '{str: int}');
    assert.strictEqual(transformType('dict[str, list[int]]'), '{str: [int]}');
  });

  test('set[T] -> {T}', () => {
    assert.strictEqual(transformType('set[int]'), '{int}');
    assert.strictEqual(transformType('set[str]'), '{str}');
  });

  test('tuple[A, B, ...] -> (A, B, ...)', () => {
    assert.strictEqual(transformType('tuple[int, str]'), '(int, str)');
    assert.strictEqual(transformType('tuple[int, str, bool]'), '(int, str, bool)');
  });

  test('Callable[[A, B], R] -> (A -> B -> R)', () => {
    assert.strictEqual(transformType('Callable[[int], str]'), '(int -> str)');
    assert.strictEqual(transformType('Callable[[int, str], bool]'), '(int -> str -> bool)');
  });

  test('Callable[[], R] -> (() -> R)', () => {
    assert.strictEqual(transformType('Callable[[], int]'), '(() -> int)');
  });

  test('forward references stripped', () => {
    assert.strictEqual(transformType('"MyClass"'), 'MyClass');
    assert.strictEqual(transformType("'MyClass'"), 'MyClass');
  });

  test('nested types', () => {
    assert.strictEqual(transformType('list[dict[str, int]]'), '[{str: int}]');
    assert.strictEqual(transformType('dict[str, list[tuple[int, str]]]'), '{str: [(int, str)]}');
    assert.strictEqual(transformType('Optional[list[int]]'), '[int]?');
  });

  test('case insensitive for builtins', () => {
    assert.strictEqual(transformType('List[int]'), '[int]');
    assert.strictEqual(transformType('Dict[str, int]'), '{str: int}');
    assert.strictEqual(transformType('Tuple[int, str]'), '(int, str)');
    assert.strictEqual(transformType('Set[int]'), '{int}');
  });

  test('*args simple type', () => {
    assert.strictEqual(transformType('*int'), '*int');
    assert.strictEqual(transformType('*str'), '*str');
  });

  test('**kwargs simple type', () => {
    assert.strictEqual(transformType('**int'), '**int');
    assert.strictEqual(transformType('**str'), '**str');
  });

  test('*args with union type gets parentheses', () => {
    assert.strictEqual(transformType('*int | str'), '*(int | str)');
    assert.strictEqual(transformType('*str | int | bool'), '*(str | int | bool)');
  });

  test('**kwargs with union type gets parentheses', () => {
    assert.strictEqual(transformType('**int | str'), '**(int | str)');
  });

  test('*args with complex type', () => {
    assert.strictEqual(transformType('*list[int]'), '*[int]');
  });

  test('haskellStyle single arg', () => {
    assert.strictEqual(transformType('Iterable[int]', { haskellStyle: true }), 'Iterable int');
    assert.strictEqual(transformType('Iterator[str]', { haskellStyle: true }), 'Iterator str');
  });

  test('haskellStyle multiple args', () => {
    assert.strictEqual(transformType('Mapping[str, int]', { haskellStyle: true }), 'Mapping str int');
  });

  test('haskellStyle nested types', () => {
    assert.strictEqual(transformType('Iterable[Sequence[int]]', { haskellStyle: true }), 'Iterable (Sequence int)');
    assert.strictEqual(transformType('Iterator[Mapping[str, int]]', { haskellStyle: true }), 'Iterator (Mapping str int)');
  });

  test('haskellStyle does not affect built-in transformations', () => {
    assert.strictEqual(transformType('list[int]', { haskellStyle: true }), '[int]');
    assert.strictEqual(transformType('dict[str, int]', { haskellStyle: true }), '{str: int}');
    assert.strictEqual(transformType('tuple[int, str]', { haskellStyle: true }), '(int, str)');
    assert.strictEqual(transformType('Optional[int]', { haskellStyle: true }), 'int?');
  });

  test('haskellStyle with nested built-in types', () => {
    assert.strictEqual(transformType('Iterable[list[int]]', { haskellStyle: true }), 'Iterable [int]');
    assert.strictEqual(transformType('Iterator[dict[str, int]]', { haskellStyle: true }), 'Iterator {str: int}');
  });

  test('haskellStyle disabled by default', () => {
    assert.strictEqual(transformType('Iterable[int]'), 'Iterable[int]');
    assert.strictEqual(transformType('Mapping[str, int]'), 'Mapping[str, int]');
  });

  test('Union[A, B] -> A | B', () => {
    assert.strictEqual(transformType('Union[int, str]'), 'int | str');
    assert.strictEqual(transformType('Union[A, B, C]'), 'A | B | C');
  });

  test('Union with complex types', () => {
    assert.strictEqual(transformType('Union[list[int], str]'), '[int] | str');
    assert.strictEqual(transformType('Union[dict[str, int], None]'), '{str: int} | None');
  });

  test('Union with haskellStyle has no effect (already transformed)', () => {
    assert.strictEqual(transformType('Union[Hashable, Comparable]', { haskellStyle: true }), 'Hashable | Comparable');
  });
});

suite('parseParams', () => {
  test('empty params', () => {
    assert.deepStrictEqual(parseParams(''), []);
    assert.deepStrictEqual(parseParams('   '), []);
  });

  test('simple typed params', () => {
    assert.deepStrictEqual(parseParams('x: int'), [{ name: 'x', type: 'int' }]);
    assert.deepStrictEqual(parseParams('x: int, y: str'), [
      { name: 'x', type: 'int' },
      { name: 'y', type: 'str' }
    ]);
  });

  test('params with defaults', () => {
    assert.deepStrictEqual(parseParams('x: int = 5'), [{ name: 'x', type: 'int' }]);
    assert.deepStrictEqual(parseParams('x: int = 5, y: str = "hi"'), [
      { name: 'x', type: 'int' },
      { name: 'y', type: 'str' }
    ]);
  });

  test('untyped params', () => {
    assert.deepStrictEqual(parseParams('x'), [{ name: 'x', type: null }]);
    assert.deepStrictEqual(parseParams('x, y'), [
      { name: 'x', type: null },
      { name: 'y', type: null }
    ]);
  });

  test('skips self and cls', () => {
    assert.deepStrictEqual(parseParams('self, x: int'), [{ name: 'x', type: 'int' }]);
    assert.deepStrictEqual(parseParams('cls, x: int'), [{ name: 'x', type: 'int' }]);
  });

  test('skips positional/keyword separators', () => {
    assert.deepStrictEqual(parseParams('x: int, /, y: str'), [
      { name: 'x', type: 'int' },
      { name: 'y', type: 'str' }
    ]);
    assert.deepStrictEqual(parseParams('x: int, *, y: str'), [
      { name: 'x', type: 'int' },
      { name: 'y', type: 'str' }
    ]);
  });

  test('*args and **kwargs', () => {
    assert.deepStrictEqual(parseParams('*args: int'), [{ name: 'args', type: '*int' }]);
    assert.deepStrictEqual(parseParams('**kwargs: str'), [{ name: 'kwargs', type: '**str' }]);
  });

  test('complex types in params', () => {
    assert.deepStrictEqual(parseParams('x: dict[str, int], y: list[tuple[int, str]]'), [
      { name: 'x', type: 'dict[str, int]' },
      { name: 'y', type: 'list[tuple[int, str]]' }
    ]);
  });
});

suite('parseTypeParams', () => {
  test('empty', () => {
    assert.deepStrictEqual(parseTypeParams(''), []);
    assert.deepStrictEqual(parseTypeParams('   '), []);
  });

  test('simple type params', () => {
    assert.deepStrictEqual(parseTypeParams('T'), [{ name: 'T', bound: null }]);
    assert.deepStrictEqual(parseTypeParams('T, U'), [
      { name: 'T', bound: null },
      { name: 'U', bound: null }
    ]);
  });

  test('bounded type params', () => {
    assert.deepStrictEqual(parseTypeParams('T: Comparable'), [{ name: 'T', bound: 'Comparable' }]);
    assert.deepStrictEqual(parseTypeParams('T: Comparable, U: Hashable'), [
      { name: 'T', bound: 'Comparable' },
      { name: 'U', bound: 'Hashable' }
    ]);
  });

  test('mixed bounded and unbounded', () => {
    assert.deepStrictEqual(parseTypeParams('T, U: Comparable'), [
      { name: 'T', bound: null },
      { name: 'U', bound: 'Comparable' }
    ]);
  });

  test('complex bound with nested brackets', () => {
    assert.deepStrictEqual(parseTypeParams('T: Union[Hashable, Comparable]'), [
      { name: 'T', bound: 'Union[Hashable, Comparable]' }
    ]);
  });

  test('multiple params with complex bounds', () => {
    assert.deepStrictEqual(parseTypeParams('T: Union[Comparable, Hashable], U: Sequence[int]'), [
      { name: 'T', bound: 'Union[Comparable, Hashable]' },
      { name: 'U', bound: 'Sequence[int]' }
    ]);
  });
});

suite('splitTypeArgs', () => {
  test('simple args', () => {
    assert.deepStrictEqual(splitTypeArgs('int, str'), ['int', 'str']);
    assert.deepStrictEqual(splitTypeArgs('int'), ['int']);
  });

  test('nested brackets', () => {
    assert.deepStrictEqual(splitTypeArgs('dict[str, int], list[str]'), ['dict[str, int]', 'list[str]']);
    assert.deepStrictEqual(splitTypeArgs('tuple[int, str], Callable[[int], str]'), [
      'tuple[int, str]',
      'Callable[[int], str]'
    ]);
  });

  test('empty', () => {
    assert.deepStrictEqual(splitTypeArgs(''), []);
  });
});

suite('formatHaskellSignature', () => {
  test('simple function', () => {
    const func: FunctionInfo = {
      name: 'add',
      typeParams: [],
      params: [
        { name: 'x', type: 'int' },
        { name: 'y', type: 'int' }
      ],
      returnType: 'int',
      line: 0
    };
    assert.strictEqual(formatHaskellSignature(func), 'add :: int -> int -> int');
  });

  test('no params', () => {
    const func: FunctionInfo = {
      name: 'get_value',
      typeParams: [],
      params: [],
      returnType: 'int',
      line: 0
    };
    assert.strictEqual(formatHaskellSignature(func), 'get_value :: int');
  });

  test('unknown types', () => {
    const func: FunctionInfo = {
      name: 'foo',
      typeParams: [],
      params: [{ name: 'x', type: null }],
      returnType: null,
      line: 0
    };
    assert.strictEqual(formatHaskellSignature(func), 'foo :: ? -> ?');
  });

  test('with type constraints', () => {
    const func: FunctionInfo = {
      name: 'find',
      typeParams: [{ name: 'T', bound: 'Comparable' }],
      params: [
        { name: 'items', type: 'list[T]' },
        { name: 'target', type: 'T' }
      ],
      returnType: 'Optional[int]',
      line: 0
    };
    assert.strictEqual(formatHaskellSignature(func), 'find :: (T: Comparable) => [T] -> T -> int?');
  });

  test('unused type params not shown in constraints', () => {
    const func: FunctionInfo = {
      name: 'foo',
      typeParams: [{ name: 'T', bound: 'Comparable' }],
      params: [{ name: 'x', type: 'int' }],
      returnType: 'str',
      line: 0
    };
    assert.strictEqual(formatHaskellSignature(func), 'foo :: int -> str');
  });

  test('type transformations applied', () => {
    const func: FunctionInfo = {
      name: 'process',
      typeParams: [],
      params: [{ name: 'data', type: 'dict[str, list[int]]' }],
      returnType: 'tuple[int, str]',
      line: 0
    };
    assert.strictEqual(formatHaskellSignature(func), 'process :: {str: [int]} -> (int, str)');
  });

  test('callable argument', () => {
    const func: FunctionInfo = {
      name: 'apply',
      typeParams: [],
      params: [
        { name: 'items', type: 'list[int]' },
        { name: 'fn', type: 'Callable[[int], str]' }
      ],
      returnType: 'list[str]',
      line: 0
    };
    assert.strictEqual(formatHaskellSignature(func), 'apply :: [int] -> (int -> str) -> [str]');
  });

  test('showFunctionName=true (default)', () => {
    const func: FunctionInfo = {
      name: 'add',
      typeParams: [],
      params: [
        { name: 'x', type: 'int' },
        { name: 'y', type: 'int' }
      ],
      returnType: 'int',
      line: 0
    };
    assert.strictEqual(formatHaskellSignature(func, true), 'add :: int -> int -> int');
  });

  test('showFunctionName=false simple function', () => {
    const func: FunctionInfo = {
      name: 'add',
      typeParams: [],
      params: [
        { name: 'x', type: 'int' },
        { name: 'y', type: 'int' }
      ],
      returnType: 'int',
      line: 0
    };
    assert.strictEqual(formatHaskellSignature(func, false), 'int -> int -> int');
  });

  test('showFunctionName=false no params', () => {
    const func: FunctionInfo = {
      name: 'get_value',
      typeParams: [],
      params: [],
      returnType: 'int',
      line: 0
    };
    assert.strictEqual(formatHaskellSignature(func, false), 'int');
  });

  test('showFunctionName=false unknown types', () => {
    const func: FunctionInfo = {
      name: 'foo',
      typeParams: [],
      params: [{ name: 'x', type: null }],
      returnType: null,
      line: 0
    };
    assert.strictEqual(formatHaskellSignature(func, false), '? -> ?');
  });

  test('showFunctionName=false with constraints', () => {
    const func: FunctionInfo = {
      name: 'find',
      typeParams: [{ name: 'T', bound: 'Comparable' }],
      params: [
        { name: 'items', type: 'list[T]' },
        { name: 'target', type: 'T' }
      ],
      returnType: 'Optional[int]',
      line: 0
    };
    assert.strictEqual(formatHaskellSignature(func, false), '(T: Comparable) => [T] -> T -> int?');
  });

  test('showFunctionName=false complex types', () => {
    const func: FunctionInfo = {
      name: 'process',
      typeParams: [],
      params: [{ name: 'data', type: 'dict[str, list[int]]' }],
      returnType: 'tuple[int, str]',
      line: 0
    };
    assert.strictEqual(formatHaskellSignature(func, false), '{str: [int]} -> (int, str)');
  });

  test('showFunctionName=false callable argument', () => {
    const func: FunctionInfo = {
      name: 'apply',
      typeParams: [],
      params: [
        { name: 'items', type: 'list[int]' },
        { name: 'fn', type: 'Callable[[int], str]' }
      ],
      returnType: 'list[str]',
      line: 0
    };
    assert.strictEqual(formatHaskellSignature(func, false), '[int] -> (int -> str) -> [str]');
  });

  test('haskellStyle=true with generic types', () => {
    const func: FunctionInfo = {
      name: 'iter',
      typeParams: [],
      params: [{ name: 'x', type: 'Iterable[int]' }],
      returnType: 'Iterator[int]',
      line: 0
    };
    assert.strictEqual(formatHaskellSignature(func, true, true), 'iter :: Iterable int -> Iterator int');
  });

  test('haskellStyle=true with nested generic types', () => {
    const func: FunctionInfo = {
      name: 'nested',
      typeParams: [],
      params: [{ name: 'x', type: 'Iterable[Sequence[int]]' }],
      returnType: 'Iterator[Mapping[str, int]]',
      line: 0
    };
    assert.strictEqual(formatHaskellSignature(func, true, true), 'nested :: Iterable (Sequence int) -> Iterator (Mapping str int)');
  });

  test('haskellStyle=false preserves bracket notation', () => {
    const func: FunctionInfo = {
      name: 'iter',
      typeParams: [],
      params: [{ name: 'x', type: 'Iterable[int]' }],
      returnType: 'Iterator[int]',
      line: 0
    };
    assert.strictEqual(formatHaskellSignature(func, true, false), 'iter :: Iterable[int] -> Iterator[int]');
  });

  test('complex bounded type param with Union', () => {
    const func: FunctionInfo = {
      name: 'fn',
      typeParams: [{ name: 'T', bound: 'Union[Hashable, Comparable]' }],
      params: [{ name: 'x', type: 'T' }],
      returnType: 'None',
      line: 0
    };
    // Union is always transformed to | regardless of haskellStyle
    assert.strictEqual(formatHaskellSignature(func, true, true), 'fn :: (T: Hashable | Comparable) => T -> None');
    assert.strictEqual(formatHaskellSignature(func, true, false), 'fn :: (T: Hashable | Comparable) => T -> None');
  });
});

suite('parseFunctionsFromText', () => {
  test('simple function', () => {
    const text = `def foo(x: int) -> str:
    return str(x)`;
    const funcs = parseFunctionsFromText(text);
    assert.strictEqual(funcs.length, 1);
    assert.strictEqual(funcs[0].name, 'foo');
    assert.deepStrictEqual(funcs[0].params, [{ name: 'x', type: 'int' }]);
    assert.strictEqual(funcs[0].returnType, 'str');
  });

  test('function with simple type param', () => {
    const text = `def identity[T](x: T) -> T:
    return x`;
    const funcs = parseFunctionsFromText(text);
    assert.strictEqual(funcs.length, 1);
    assert.strictEqual(funcs[0].name, 'identity');
    assert.deepStrictEqual(funcs[0].typeParams, [{ name: 'T', bound: null }]);
    assert.deepStrictEqual(funcs[0].params, [{ name: 'x', type: 'T' }]);
    assert.strictEqual(funcs[0].returnType, 'T');
  });

  test('function with bounded type param using pipe', () => {
    const text = `def sort_items[T: Comparable | Hashable](items: list[T]) -> list[T]:
    return sorted(items)`;
    const funcs = parseFunctionsFromText(text);
    assert.strictEqual(funcs.length, 1);
    assert.strictEqual(funcs[0].name, 'sort_items');
    assert.deepStrictEqual(funcs[0].typeParams, [{ name: 'T', bound: 'Comparable | Hashable' }]);
    assert.deepStrictEqual(funcs[0].params, [{ name: 'items', type: 'list[T]' }]);
    assert.strictEqual(funcs[0].returnType, 'list[T]');
  });

  test('function with bounded type param using Union', () => {
    const text = `def sort_items[T: Union[Comparable, Hashable]](items: list[T]) -> list[T]:
    return sorted(items)`;
    const funcs = parseFunctionsFromText(text);
    assert.strictEqual(funcs.length, 1);
    assert.strictEqual(funcs[0].name, 'sort_items');
    assert.deepStrictEqual(funcs[0].typeParams, [{ name: 'T', bound: 'Union[Comparable, Hashable]' }]);
    assert.deepStrictEqual(funcs[0].params, [{ name: 'items', type: 'list[T]' }]);
    assert.strictEqual(funcs[0].returnType, 'list[T]');
  });

  test('class with Union bound type param', () => {
    const text = `class Foo[T: Union[Hashable, Comparable]]:
    def fn(self, x: T) -> None:
        return`;
    const funcs = parseFunctionsFromText(text);
    assert.strictEqual(funcs.length, 1);
    assert.strictEqual(funcs[0].name, 'fn');
    assert.deepStrictEqual(funcs[0].typeParams, [{ name: 'T', bound: 'Union[Hashable, Comparable]' }]);
    assert.deepStrictEqual(funcs[0].params, [{ name: 'x', type: 'T' }]);
    assert.strictEqual(funcs[0].returnType, 'None');
  });
});

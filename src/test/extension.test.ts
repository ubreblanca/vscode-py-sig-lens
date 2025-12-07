import * as assert from 'assert';
import {
  transformType,
  parseParams,
  parseTypeParams,
  splitTypeArgs,
  formatHaskellSignature,
  FunctionInfo
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
});

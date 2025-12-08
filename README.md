![Screenshot](screenshot.png)

# Python Signature Lens

Display Haskell-style type signatures above Python functions using CodeLens.

Download here: https://marketplace.visualstudio.com/items?itemName=ubreblanca.python-signature-lens

## Features

- Curried function signatures displayed above Python function definitions
- Supports generic type parameters and bounded constraints
- Handles class methods with inherited type parameters
- Works with async functions and multi-line signatures

## Type Transformations

| Python | Lens Displays |
|--------|---------------|
| `Optional[T]` | `T?` |
| `T \| None` | `T?` |
| `None \| T` | `T?` |
| `Union[A, B]` | `A \| B` |
| `list[T]` | `[T]` |
| `dict[K, V]` | `{K: V}` |
| `set[T]` | `{T}` |
| `tuple[A, B, C]` | `(A, B, C)` |
| `Callable[[A, B], R]` | `(A -> B -> R)` |
| `Callable[[], R]` | `(() -> R)` |
| `"ForwardRef"` | `ForwardRef` |
| `*args: T` | `*T` |
| `**kwargs: T` | `**T` |

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `pythonSignatureLens.enabled` | Enable/disable signatures | `true` |
| `pythonSignatureLens.showFunctionName` | Show function name in signature | `true` |
| `pythonSignatureLens.haskellStyleApplication` | Use Haskell-style type application | `false` |

### Haskell-Style Type Application

When `haskellStyleApplication` is enabled, generic types use space-delimited syntax:

| Python | Default | With `haskellStyleApplication` |
|--------|---------|-------------------------------|
| `Iterable[A]` | `Iterable[A]` | `Iterable A` |
| `Mapping[K, V]` | `Mapping[K, V]` | `Mapping K V` |
| `Iterator[Sequence[A]]` | `Iterator[Sequence[A]]` | `Iterator (Sequence A)` |


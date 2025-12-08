# Changelog

## [0.0.2] - 2025-12-08

- Add `showFunctionName` setting to optionally hide function name from signature
- Add `haskellStyleApplication` setting for Haskell-style type application
- Add `Union[A, B]` -> `A | B` transformation
- Fix parentheses for `*args`/`**kwargs` with union types (e.g., `*(A | B)`)
- Fix parsing of type parameter bounds with nested brackets (e.g., `T: Union[A, B]`)
- Fix parsing of function signatures with nested brackets in type parameters
- Fix unnecessary parentheses in `haskellStyleApplication` for nested built-in types

## [0.0.1] - 2025-12-07

- Initial release
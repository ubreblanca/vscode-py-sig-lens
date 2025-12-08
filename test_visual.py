"""
Visual test file for Python Signature Lens extension.
Open this file in VS Code with the extension enabled to test the CodeLens display.

Toggle settings to test:
- pythonSignatureLens.enabled: true/false
- pythonSignatureLens.showFunctionName: true/false
"""

from typing import Union
from typing import (
    Optional,
    Callable,
    TypeVar,
    Generic,
    Any,
    Literal,
    Protocol,
    Self,
)
from collections.abc import Iterator, Iterable, Mapping, Sequence


class Comparable(Protocol):
    def __lt__(self, other: Self) -> bool: ...
    def __le__(self, other: Self) -> bool: ...
    def __gt__(self, other: Self) -> bool: ...
    def __ge__(self, other: Self) -> bool: ...


class Hashable(Protocol):
    def __hash__(self) -> int: ...


# === BASIC FUNCTIONS ===

def add(x: int, y: int) -> int:
    return x + y


def greet(name: str) -> str:
    return f"Hello, {name}!"


def get_answer() -> int:
    return 42


def no_annotations(x):
    return x


def partial_annotations(x: int, y):
    return x + y


# === OPTIONAL AND UNION TYPES ===

def maybe_int() -> Optional[int]:
    return None


def find_index(items: list[str], target: str) -> Optional[int]:
    try:
        return items.index(target)
    except ValueError:
        return None


def parse_int(s: str) -> int | None:
    try:
        return int(s)
    except ValueError:
        return None


def nullable_first(s: None | str) -> str | None:
    return s


def string_or_int(value: str | int) -> str:
    return str(value)


# === COLLECTION TYPES ===

def sum_list(numbers: list[int]) -> int:
    return sum(numbers)


def keys(d: dict[str, int]) -> list[str]:
    return list(d.keys())


def unique(items: list[int]) -> set[int]:
    return set(items)


def swap(pair: tuple[int, str]) -> tuple[str, int]:
    return (pair[1], pair[0])


def nested(d: dict[str, list[int]]) -> list[tuple[str, list[int]]]:
    return list(d.items())


# === CALLABLE TYPES ===

def apply(x: int, f: Callable[[int], str]) -> str:
    return f(x)


def map_list(items: list[int], fn: Callable[[int], str]) -> list[str]:
    return [fn(x) for x in items]


A = TypeVar('A')
B = TypeVar('B')
C = TypeVar('C')


def compose(f: Callable[[A], B], g: Callable[[B], C]) -> Callable[[A], C]:
    return lambda x: g(f(x))


def thunk(f: Callable[[], int]) -> int:
    return f()


def binary_op(op: Callable[[int, int], int], x: int, y: int) -> int:
    return op(x, y)


# === GENERIC FUNCTIONS WITH TYPE PARAMETERS ===

T = TypeVar('T')
U = TypeVar('U')


def identity(x: T) -> T:
    return x


def first(items: list[T]) -> Optional[T]:
    return items[0] if items else None


def pair(a: T, b: U) -> tuple[T, U]:
    return (a, b)


# === BOUNDED TYPE PARAMETERS (CONSTRAINTS) ===

def find_max[T: Comparable](items: list[T]) -> T:
    return max(items)


def sort_items[T: Union[Comparable, Hashable]](items: list[T]) -> list[T]:
    return sorted(items)


def hash_it[T: Hashable](item: T) -> int:
    return hash(item)


def multiple_bounds[T: Comparable, U: Hashable](a: T, b: U) -> tuple[T, U]:
    return (a, b)


def unused_bound[T: Comparable](x: int) -> str:
    return str(x)


# === *ARGS AND **KWARGS ===

def variadic(*args: int) -> int:
    return sum(args)


def keyword_args(**kwargs: str) -> dict[str, str]:
    return kwargs


def mixed_args(x: int, *args: str | int, **kwargs: int) -> None:
    pass


# === ASYNC FUNCTIONS ===

async def fetch_data(url: str) -> str:
    return "data"


async def process_async(items: list[str]) -> list[str]:
    return items


# === CLASS METHODS ===

class Calculator:
    def __init__(self, initial: int) -> None:
        self.value = initial

    def add(self, x: int) -> int:
        self.value += x
        return self.value

    def multiply(self, x: int) -> int:
        self.value *= x
        return self.value

    def reset(self) -> None:
        self.value = 0

    @classmethod
    def from_string(cls, s: str) -> "Calculator":
        return cls(int(s))

    @staticmethod
    def zero() -> "Calculator":
        return Calculator(0)


class Foo[T: Union[Hashable, Comparable]]:
    def fn(_: T) -> None:
        return


# === GENERIC CLASS WITH INHERITED TYPE PARAMS ===

class Box(Generic[T]):
    def __init__(self, value: T) -> None:
        self.value = value

    def get(self) -> T:
        return self.value

    def map(self, f: Callable[[T], U]) -> "Box[U]":
        return Box(f(self.value))

    def flat_map(self, f: Callable[[T], "Box[U]"]) -> "Box[U]":
        return f(self.value)


# === FORWARD REFERENCES ===

class Node:
    def __init__(self, value: int, next: "Node | None") -> None:
        self.value = value
        self.next = next

    def append(self, node: "Node") -> "Node":
        self.next = node
        return self


def create_node(value: int) -> "Node":
    return Node(value, None)


# === SPECIAL TYPES ===

def anything(x: Any) -> Any:
    return x


def literal_status(status: Literal["ok", "error"]) -> bool:
    return status == "ok"


def iterator(items: list[T]) -> Iterator[T]:
    return iter(items)


def iterable_to_list(items: Iterable[T]) -> list[T]:
    return list(items)


def mapping_keys(m: Mapping[str, T]) -> list[str]:
    return list(m.keys())


def sequence_first(s: Sequence[T]) -> Optional[T]:
    return s[0] if s else None


# === MULTI-LINE SIGNATURES ===

def complex_function(
    data: dict[str, list[int]],
    transformer: Callable[[int], str],
    prefix: Optional[str] = None,
) -> list[tuple[str, int]]:
    result = []
    for key, values in data.items():
        for v in values:
            result.append((transformer(v), v))
    return result


# === EDGE CASES ===

def _single_underscore(x: int) -> int:
    return x


def __double_underscore(x: int) -> int:
    return x


def __call__(x: int) -> int:
    return x

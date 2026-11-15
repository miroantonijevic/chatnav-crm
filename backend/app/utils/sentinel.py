"""Sentinel for "argument not provided" (distinguishes it from an explicit None)"""


class _Unset:
    def __repr__(self) -> str:
        return "UNSET"

    def __bool__(self) -> bool:
        return False


UNSET = _Unset()

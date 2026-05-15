from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation


def decimal_amount(value) -> Decimal | None:
    if value is None:
        return None
    if hasattr(value, "amount"):
        value = value.amount
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def format_decimal(value, places: int = 2, *, trim: bool = False) -> str:
    amount = decimal_amount(value)
    if amount is None:
        return "--"
    quant = Decimal("1").scaleb(-places)
    text = f"{amount.quantize(quant, rounding=ROUND_HALF_UP):,.{places}f}"
    text = text.replace(",", "X").replace(".", ",").replace("X", ".")
    if trim and "," in text:
        text = text.rstrip("0").rstrip(",")
    return text


def format_brl(value) -> str:
    amount = decimal_amount(value)
    if amount is None:
        return "R$ 0,00"
    return f"R$ {format_decimal(amount, 2)}"

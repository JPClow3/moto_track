from django.db import models
from djmoney.models.fields import MoneyField

from apps.core.models import TimeStampedModel, UserOwnedModel


class InventoryItem(TimeStampedModel, UserOwnedModel):
    name = models.CharField(max_length=255, verbose_name="Nome da Peça/Item")
    description = models.TextField(blank=True, verbose_name="Descrição/Anotações")
    part_number = models.CharField(max_length=100, blank=True, verbose_name="Número da Peça (PN)")
    quantity = models.PositiveIntegerField(default=0, verbose_name="Quantidade em Estoque")
    unit_cost = MoneyField(max_digits=10, decimal_places=2, default=0, verbose_name="Custo Unitário Médio")

    class Meta:
        verbose_name = "Item de Inventário"
        verbose_name_plural = "Itens de Inventário"
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} (Qtd: {self.quantity})"

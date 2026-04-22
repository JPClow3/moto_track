from django.db import models
from django.conf import settings
from decimal import Decimal

class InventoryItem(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="inventory_items")
    name = models.CharField(max_length=255, verbose_name="Nome da Peça/Item")
    description = models.TextField(blank=True, verbose_name="Descrição/Anotações")
    part_number = models.CharField(max_length=100, blank=True, verbose_name="Número da Peça (PN)")
    quantity = models.PositiveIntegerField(default=0, verbose_name="Quantidade em Estoque")
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"), verbose_name="Custo Unitário Médio")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Item de Inventário"
        verbose_name_plural = "Itens de Inventário"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} (Qtd: {self.quantity})"


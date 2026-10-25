-- Verified official tables checked on 2026-10-23. No owner plans are rewritten.
-- Only the NH 190/NH 300 2025/2026 rows have both authoritative year coverage
-- and a cadence represented faithfully by the phased maintenance engine.
-- Other transcriptions remain nonautomatic until the stated ambiguity is resolved.
-- Source evidence, precise applicability and PDF fingerprints: docs/catalog-coverage-20261023.md.
-- Requires 20261023120000_maintenance_schedule_phases.sql.

do $migration$
declare
  catalog jsonb := $catalog$
[
  {
    "id": "8f7aff3e-c51c-5678-8ae7-a308dafe2bfd",
    "model_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe020",
    "brand": "Dafra",
    "model": "NH 190",
    "variant": "Trail",
    "engine_cc": 183,
    "year_from": 2025,
    "year_to": 2025,
    "generation": "PROMOT 5",
    "is_exact_schedule": true,
    "source_id": "41373aa6-d8dd-5f3d-a8cd-42c3a944f141",
    "official_url": "https://daframotos.com.br/documentos/pos-vendas-dafra-motos-manual-proprietario-nh-190-modelo-2025-em-diante--jan-25.pdf",
    "document_version": "80503-A41-401 PROMOT 5 rev. 02",
    "page_reference": "Programa preventivo, p. 52-54 (PDF p. 56-58); prazos e nota fiscal, p. 6 (PDF p. 10)",
    "coverage_notes": "Cobre somente Dafra NH 190, ano-modelo 2025, PROMOT 5, uso normal. O portal oficial identifica modelos 2025/2026 separadamente de 2027. Marcos contam desde a entrada original em serviço, não desde a compra de uma moto usada. Condições severas exigem plano da autorizada.",
    "items": [
      {
        "maintenance_type": "Filtro de ar - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Examinar o elemento e limpar conforme manual; substituir no marco de 12.000 km.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Filtro de óleo - tela",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar e limpar a tela na troca de óleo.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Óleo do motor",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Trocar o óleo e conferir o nível antes de pilotar.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Arrefecimento - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar funcionamento e nível do líquido.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Vela de ignição - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Examinar e ajustar a vela; a troca tem plano próprio.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Conferir a folga dos rolamentos; lubrificação tem plano próprio.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Combustível - vazamentos",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar estanqueidade e linhas do tanque.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Motor - vazamentos",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar vazamentos no cárter.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Acelerador",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar acionamento e cabo.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Fixações do motor",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar porcas e parafusos.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Respiro do cárter",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar o sistema de ventilação do cárter.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Bateria",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar o estado da bateria.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Embreagem",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar a folga.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Freios - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar acionamento, cabos e material de atrito; substituir por condição, sem inventar intervalo de troca.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Fixações gerais",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar aperto das fixações dos componentes.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Balança traseira - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar o garfo traseiro.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Cabos e articulações - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Examinar cabos e peças móveis.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Cabeçote, cilindro e pistão",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Inspecionar.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Escape e carbonização",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Inspecionar o escapamento e depósitos.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Folga de válvulas",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar a folga, sem confundir com a periodicidade da vela.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Amortecedores",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Inspecionar dianteira e traseira.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Cavaletes",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar e lubrificar.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Balança traseira - lubrificação",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar e lubrificar o garfo traseiro.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Marcha lenta",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar e ajustar.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 12000,
        "interval_days": 720,
        "notes": "Substituir o elemento.",
        "schedule_milestones": [
          {
            "km": 12000,
            "months": 30
          }
        ],
        "recurrence_km": 12000,
        "recurrence_months": 24
      },
      {
        "maintenance_type": "Vela de ignição - troca",
        "interval_km": 12000,
        "interval_days": 720,
        "notes": "Substituir a vela.",
        "schedule_milestones": [
          {
            "km": 12000,
            "months": 30
          }
        ],
        "recurrence_km": 12000,
        "recurrence_months": 24
      },
      {
        "maintenance_type": "Direção - lubrificação",
        "interval_km": 12000,
        "interval_days": 720,
        "notes": "Verificar folga e lubrificar os rolamentos.",
        "schedule_milestones": [
          {
            "km": 12000,
            "months": 30
          }
        ],
        "recurrence_km": 12000,
        "recurrence_months": 24
      },
      {
        "maintenance_type": "Filtro da bomba de combustível",
        "interval_km": 9000,
        "interval_days": 540,
        "notes": "Substituir o filtro.",
        "schedule_milestones": [
          {
            "km": 9000,
            "months": 24
          }
        ],
        "recurrence_km": 9000,
        "recurrence_months": 18
      },
      {
        "maintenance_type": "Óleo da suspensão dianteira",
        "interval_km": 15000,
        "interval_days": null,
        "notes": "Trocar a cada 15.000 km; a linha não informa prazo em meses.",
        "schedule_milestones": [
          {
            "km": 15000,
            "months": null
          }
        ],
        "recurrence_km": 15000,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Mangueiras, líquido e vedações do arrefecimento",
        "interval_km": null,
        "interval_days": 1080,
        "notes": "Substituir o conjunto indicado pelo manual a cada três anos.",
        "schedule_milestones": [
          {
            "km": null,
            "months": 36
          }
        ],
        "recurrence_km": null,
        "recurrence_months": 36
      },
      {
        "maintenance_type": "Corrente de transmissão",
        "interval_km": 500,
        "interval_days": null,
        "notes": "Inspecionar, limpar, lubrificar e ajustar também após chuva ou lavagem.",
        "schedule_milestones": [
          {
            "km": 500,
            "months": null
          }
        ],
        "recurrence_km": 500,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus - pressão",
        "interval_km": null,
        "interval_days": 7,
        "notes": "Conferir semanalmente; inspeções antes de pilotar continuam obrigatórias.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rodas - inspeção semanal",
        "interval_km": null,
        "interval_days": 7,
        "notes": "Examinar as rodas e os raios semanalmente.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      }
    ]
  },
  {
    "id": "b9b82c42-264b-5da0-b295-5034d2aa46cc",
    "model_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe020",
    "brand": "Dafra",
    "model": "NH 190",
    "variant": "Trail",
    "engine_cc": 183,
    "year_from": 2026,
    "year_to": 2026,
    "generation": "PROMOT 5",
    "is_exact_schedule": true,
    "source_id": "b90b7ca4-4a2a-562e-8179-1eb1760e4e27",
    "official_url": "https://daframotos.com.br/documentos/pos-vendas-dafra-motos-manual-proprietario-nh-190-modelo-2025-em-diante--jan-25.pdf",
    "document_version": "80503-A41-401 PROMOT 5 rev. 02",
    "page_reference": "Programa preventivo, p. 52-54 (PDF p. 56-58); prazos e nota fiscal, p. 6 (PDF p. 10)",
    "coverage_notes": "Cobre somente Dafra NH 190, ano-modelo 2026, PROMOT 5, uso normal. O portal oficial identifica modelos 2025/2026 separadamente de 2027. Marcos contam desde a entrada original em serviço, não desde a compra de uma moto usada. Condições severas exigem plano da autorizada.",
    "items": [
      {
        "maintenance_type": "Filtro de ar - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Examinar o elemento e limpar conforme manual; substituir no marco de 12.000 km.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Filtro de óleo - tela",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar e limpar a tela na troca de óleo.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Óleo do motor",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Trocar o óleo e conferir o nível antes de pilotar.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Arrefecimento - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar funcionamento e nível do líquido.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Vela de ignição - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Examinar e ajustar a vela; a troca tem plano próprio.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Conferir a folga dos rolamentos; lubrificação tem plano próprio.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Combustível - vazamentos",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar estanqueidade e linhas do tanque.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Motor - vazamentos",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar vazamentos no cárter.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Acelerador",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar acionamento e cabo.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Fixações do motor",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar porcas e parafusos.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Respiro do cárter",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar o sistema de ventilação do cárter.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Bateria",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar o estado da bateria.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Embreagem",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar a folga.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Freios - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar acionamento, cabos e material de atrito; substituir por condição, sem inventar intervalo de troca.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Fixações gerais",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar aperto das fixações dos componentes.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Balança traseira - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar o garfo traseiro.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Cabos e articulações - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Examinar cabos e peças móveis.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Cabeçote, cilindro e pistão",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Inspecionar.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Escape e carbonização",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Inspecionar o escapamento e depósitos.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Folga de válvulas",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar a folga, sem confundir com a periodicidade da vela.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Amortecedores",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Inspecionar dianteira e traseira.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Cavaletes",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar e lubrificar.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Balança traseira - lubrificação",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar e lubrificar o garfo traseiro.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Marcha lenta",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar e ajustar.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 12000,
        "interval_days": 720,
        "notes": "Substituir o elemento.",
        "schedule_milestones": [
          {
            "km": 12000,
            "months": 30
          }
        ],
        "recurrence_km": 12000,
        "recurrence_months": 24
      },
      {
        "maintenance_type": "Vela de ignição - troca",
        "interval_km": 12000,
        "interval_days": 720,
        "notes": "Substituir a vela.",
        "schedule_milestones": [
          {
            "km": 12000,
            "months": 30
          }
        ],
        "recurrence_km": 12000,
        "recurrence_months": 24
      },
      {
        "maintenance_type": "Direção - lubrificação",
        "interval_km": 12000,
        "interval_days": 720,
        "notes": "Verificar folga e lubrificar os rolamentos.",
        "schedule_milestones": [
          {
            "km": 12000,
            "months": 30
          }
        ],
        "recurrence_km": 12000,
        "recurrence_months": 24
      },
      {
        "maintenance_type": "Filtro da bomba de combustível",
        "interval_km": 9000,
        "interval_days": 540,
        "notes": "Substituir o filtro.",
        "schedule_milestones": [
          {
            "km": 9000,
            "months": 24
          }
        ],
        "recurrence_km": 9000,
        "recurrence_months": 18
      },
      {
        "maintenance_type": "Óleo da suspensão dianteira",
        "interval_km": 15000,
        "interval_days": null,
        "notes": "Trocar a cada 15.000 km; a linha não informa prazo em meses.",
        "schedule_milestones": [
          {
            "km": 15000,
            "months": null
          }
        ],
        "recurrence_km": 15000,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Mangueiras, líquido e vedações do arrefecimento",
        "interval_km": null,
        "interval_days": 1080,
        "notes": "Substituir o conjunto indicado pelo manual a cada três anos.",
        "schedule_milestones": [
          {
            "km": null,
            "months": 36
          }
        ],
        "recurrence_km": null,
        "recurrence_months": 36
      },
      {
        "maintenance_type": "Corrente de transmissão",
        "interval_km": 500,
        "interval_days": null,
        "notes": "Inspecionar, limpar, lubrificar e ajustar também após chuva ou lavagem.",
        "schedule_milestones": [
          {
            "km": 500,
            "months": null
          }
        ],
        "recurrence_km": 500,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus - pressão",
        "interval_km": null,
        "interval_days": 7,
        "notes": "Conferir semanalmente; inspeções antes de pilotar continuam obrigatórias.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rodas - inspeção semanal",
        "interval_km": null,
        "interval_days": 7,
        "notes": "Examinar as rodas e os raios semanalmente.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      }
    ]
  },
  {
    "id": "d2ac9ab6-3dbc-58ff-aec3-00dcc1a4a9b3",
    "model_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe022",
    "brand": "Dafra",
    "model": "NH 300",
    "variant": "Trail",
    "engine_cc": 278,
    "year_from": 2025,
    "year_to": 2025,
    "generation": "PROMOT 5",
    "is_exact_schedule": true,
    "source_id": "d15bd050-2a1b-5596-8909-d1249fd930fe",
    "official_url": "https://daframotos.com.br/documentos/pos-vendas-dafra-motos-manual-proprietario-nh-300-modelo-2025-em-diante--jan-25.pdf",
    "document_version": "80503-B42-101 PROMOT 5 rev. 02",
    "page_reference": "Programa preventivo, p. 52-54 (PDF p. 56-58); prazos e nota fiscal, p. 6 (PDF p. 10)",
    "coverage_notes": "Cobre somente Dafra NH 300, ano-modelo 2025, PROMOT 5, uso normal. O portal oficial identifica modelos 2025/2026 separadamente de 2027. Marcos contam desde a entrada original em serviço, não desde a compra de uma moto usada. Condições severas exigem plano da autorizada.",
    "items": [
      {
        "maintenance_type": "Filtro de ar - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Examinar o elemento e limpar conforme manual; substituir no marco de 12.000 km.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Filtro de óleo - tela",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar e limpar a tela na troca de óleo.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Óleo do motor",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Trocar o óleo e conferir o nível antes de pilotar.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Arrefecimento - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar funcionamento e nível do líquido.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Vela de ignição - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Examinar e ajustar a vela; a troca tem plano próprio.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Conferir a folga dos rolamentos; lubrificação tem plano próprio.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Combustível - vazamentos",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar estanqueidade e linhas do tanque.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Motor - vazamentos",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar vazamentos no cárter.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Acelerador",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar acionamento e cabo.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Fixações do motor",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar porcas e parafusos.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Respiro do cárter",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar o sistema de ventilação do cárter.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Bateria",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar o estado da bateria.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Embreagem",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar a folga.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Freios - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar acionamento, cabos e material de atrito; substituir por condição, sem inventar intervalo de troca.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Fixações gerais",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar aperto das fixações dos componentes.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Balança traseira - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar o garfo traseiro.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Cabos e articulações - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Examinar cabos e peças móveis.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Cabeçote, cilindro e pistão",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Inspecionar.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Escape e carbonização",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Inspecionar o escapamento e depósitos.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Folga de válvulas",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar a folga, sem confundir com a periodicidade da vela.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Amortecedores",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Inspecionar dianteira e traseira.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Cavaletes",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar e lubrificar.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Balança traseira - lubrificação",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar e lubrificar o garfo traseiro.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Marcha lenta",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar e ajustar.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 12000,
        "interval_days": 720,
        "notes": "Substituir o elemento.",
        "schedule_milestones": [
          {
            "km": 12000,
            "months": 30
          }
        ],
        "recurrence_km": 12000,
        "recurrence_months": 24
      },
      {
        "maintenance_type": "Vela de ignição - troca",
        "interval_km": 12000,
        "interval_days": 720,
        "notes": "Substituir a vela.",
        "schedule_milestones": [
          {
            "km": 12000,
            "months": 30
          }
        ],
        "recurrence_km": 12000,
        "recurrence_months": 24
      },
      {
        "maintenance_type": "Direção - lubrificação",
        "interval_km": 12000,
        "interval_days": 720,
        "notes": "Verificar folga e lubrificar os rolamentos.",
        "schedule_milestones": [
          {
            "km": 12000,
            "months": 30
          }
        ],
        "recurrence_km": 12000,
        "recurrence_months": 24
      },
      {
        "maintenance_type": "Filtro da bomba de combustível",
        "interval_km": 9000,
        "interval_days": 540,
        "notes": "Substituir o filtro.",
        "schedule_milestones": [
          {
            "km": 9000,
            "months": 24
          }
        ],
        "recurrence_km": 9000,
        "recurrence_months": 18
      },
      {
        "maintenance_type": "Óleo da suspensão dianteira",
        "interval_km": 15000,
        "interval_days": null,
        "notes": "Trocar a cada 15.000 km; a linha não informa prazo em meses.",
        "schedule_milestones": [
          {
            "km": 15000,
            "months": null
          }
        ],
        "recurrence_km": 15000,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Mangueiras, líquido e vedações do arrefecimento",
        "interval_km": null,
        "interval_days": 1080,
        "notes": "Substituir o conjunto indicado pelo manual a cada três anos.",
        "schedule_milestones": [
          {
            "km": null,
            "months": 36
          }
        ],
        "recurrence_km": null,
        "recurrence_months": 36
      },
      {
        "maintenance_type": "Corrente de transmissão",
        "interval_km": 500,
        "interval_days": null,
        "notes": "Inspecionar, limpar, lubrificar e ajustar também após chuva ou lavagem.",
        "schedule_milestones": [
          {
            "km": 500,
            "months": null
          }
        ],
        "recurrence_km": 500,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus - pressão",
        "interval_km": null,
        "interval_days": 7,
        "notes": "Conferir semanalmente; inspeções antes de pilotar continuam obrigatórias.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rodas - inspeção semanal",
        "interval_km": null,
        "interval_days": 7,
        "notes": "Examinar as rodas e os raios semanalmente.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de óleo - papel",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Substituir junto com o óleo.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      }
    ]
  },
  {
    "id": "0fce20b5-9cca-5eb3-860d-ad86fe484d27",
    "model_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe022",
    "brand": "Dafra",
    "model": "NH 300",
    "variant": "Trail",
    "engine_cc": 278,
    "year_from": 2026,
    "year_to": 2026,
    "generation": "PROMOT 5",
    "is_exact_schedule": true,
    "source_id": "16e0b987-af80-5b66-9de5-b3cfc7b28f08",
    "official_url": "https://daframotos.com.br/documentos/pos-vendas-dafra-motos-manual-proprietario-nh-300-modelo-2025-em-diante--jan-25.pdf",
    "document_version": "80503-B42-101 PROMOT 5 rev. 02",
    "page_reference": "Programa preventivo, p. 52-54 (PDF p. 56-58); prazos e nota fiscal, p. 6 (PDF p. 10)",
    "coverage_notes": "Cobre somente Dafra NH 300, ano-modelo 2026, PROMOT 5, uso normal. O portal oficial identifica modelos 2025/2026 separadamente de 2027. Marcos contam desde a entrada original em serviço, não desde a compra de uma moto usada. Condições severas exigem plano da autorizada.",
    "items": [
      {
        "maintenance_type": "Filtro de ar - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Examinar o elemento e limpar conforme manual; substituir no marco de 12.000 km.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Filtro de óleo - tela",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar e limpar a tela na troca de óleo.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Óleo do motor",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Trocar o óleo e conferir o nível antes de pilotar.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Arrefecimento - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar funcionamento e nível do líquido.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Vela de ignição - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Examinar e ajustar a vela; a troca tem plano próprio.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Conferir a folga dos rolamentos; lubrificação tem plano próprio.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Combustível - vazamentos",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar estanqueidade e linhas do tanque.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Motor - vazamentos",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar vazamentos no cárter.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Acelerador",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar acionamento e cabo.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Fixações do motor",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar porcas e parafusos.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Respiro do cárter",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar o sistema de ventilação do cárter.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Bateria",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar o estado da bateria.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Embreagem",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar a folga.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Freios - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar acionamento, cabos e material de atrito; substituir por condição, sem inventar intervalo de troca.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Fixações gerais",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar aperto das fixações dos componentes.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Balança traseira - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar o garfo traseiro.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Cabos e articulações - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Examinar cabos e peças móveis.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Cabeçote, cilindro e pistão",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Inspecionar.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Escape e carbonização",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Inspecionar o escapamento e depósitos.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Folga de válvulas",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar a folga, sem confundir com a periodicidade da vela.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Amortecedores",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Inspecionar dianteira e traseira.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Cavaletes",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar e lubrificar.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Balança traseira - lubrificação",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar e lubrificar o garfo traseiro.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Marcha lenta",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar e ajustar.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 12000,
        "interval_days": 720,
        "notes": "Substituir o elemento.",
        "schedule_milestones": [
          {
            "km": 12000,
            "months": 30
          }
        ],
        "recurrence_km": 12000,
        "recurrence_months": 24
      },
      {
        "maintenance_type": "Vela de ignição - troca",
        "interval_km": 12000,
        "interval_days": 720,
        "notes": "Substituir a vela.",
        "schedule_milestones": [
          {
            "km": 12000,
            "months": 30
          }
        ],
        "recurrence_km": 12000,
        "recurrence_months": 24
      },
      {
        "maintenance_type": "Direção - lubrificação",
        "interval_km": 12000,
        "interval_days": 720,
        "notes": "Verificar folga e lubrificar os rolamentos.",
        "schedule_milestones": [
          {
            "km": 12000,
            "months": 30
          }
        ],
        "recurrence_km": 12000,
        "recurrence_months": 24
      },
      {
        "maintenance_type": "Filtro da bomba de combustível",
        "interval_km": 9000,
        "interval_days": 540,
        "notes": "Substituir o filtro.",
        "schedule_milestones": [
          {
            "km": 9000,
            "months": 24
          }
        ],
        "recurrence_km": 9000,
        "recurrence_months": 18
      },
      {
        "maintenance_type": "Óleo da suspensão dianteira",
        "interval_km": 15000,
        "interval_days": null,
        "notes": "Trocar a cada 15.000 km; a linha não informa prazo em meses.",
        "schedule_milestones": [
          {
            "km": 15000,
            "months": null
          }
        ],
        "recurrence_km": 15000,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Mangueiras, líquido e vedações do arrefecimento",
        "interval_km": null,
        "interval_days": 1080,
        "notes": "Substituir o conjunto indicado pelo manual a cada três anos.",
        "schedule_milestones": [
          {
            "km": null,
            "months": 36
          }
        ],
        "recurrence_km": null,
        "recurrence_months": 36
      },
      {
        "maintenance_type": "Corrente de transmissão",
        "interval_km": 500,
        "interval_days": null,
        "notes": "Inspecionar, limpar, lubrificar e ajustar também após chuva ou lavagem.",
        "schedule_milestones": [
          {
            "km": 500,
            "months": null
          }
        ],
        "recurrence_km": 500,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus - pressão",
        "interval_km": null,
        "interval_days": 7,
        "notes": "Conferir semanalmente; inspeções antes de pilotar continuam obrigatórias.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rodas - inspeção semanal",
        "interval_km": null,
        "interval_days": 7,
        "notes": "Examinar as rodas e os raios semanalmente.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de óleo - papel",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Substituir junto com o óleo.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      }
    ]
  },
  {
    "id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafd021",
    "model_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe021",
    "brand": "Dafra",
    "model": "NHX 190",
    "variant": "Street",
    "engine_cc": 183,
    "year_from": 2025,
    "year_to": 2026,
    "generation": "PROMOT 5",
    "is_exact_schedule": false,
    "source_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafd221",
    "official_url": "https://daframotos.com.br/documentos/pos-vendas-dafra-motos-manual-proprietario-nhx-190--jan-25.pdf",
    "document_version": "80503-G49-001 PROMOT 5 rev. 01",
    "page_reference": "Programa preventivo, p. 52-54 (PDF p. 56-58); prazos e nota fiscal, p. 6 (PDF p. 10)",
    "coverage_notes": "Tabela PROMOT 5 transcrita e conferida. O portal separa o documento 2027, mas não explicita todos os anos cobertos por este PDF; janeiro de 2025 é edição, não prova de ano-modelo. Mantido orientativo até confirmação da aplicabilidade. Uso severo requer orientação da autorizada.",
    "items": [
      {
        "maintenance_type": "Filtro de ar - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Examinar o elemento e limpar conforme manual; substituir no marco de 12.000 km.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Filtro de óleo - tela",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar e limpar a tela na troca de óleo.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Óleo do motor",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Trocar o óleo e conferir o nível antes de pilotar.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Arrefecimento - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar funcionamento e nível do líquido.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Vela de ignição - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Examinar e ajustar a vela; a troca tem plano próprio.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Conferir a folga dos rolamentos; lubrificação tem plano próprio.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Combustível - vazamentos",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar estanqueidade e linhas do tanque.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Motor - vazamentos",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar vazamentos no cárter.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Acelerador",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar acionamento e cabo.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Fixações do motor",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar porcas e parafusos.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Respiro do cárter",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar o sistema de ventilação do cárter.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Bateria",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar o estado da bateria.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Embreagem",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar a folga.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Freios - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar acionamento, cabos e material de atrito; substituir por condição, sem inventar intervalo de troca.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Fixações gerais",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Inspecionar aperto das fixações dos componentes.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Balança traseira - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Verificar o garfo traseiro.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Cabos e articulações - inspeção",
        "interval_km": 3000,
        "interval_days": 180,
        "notes": "Examinar cabos e peças móveis.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 3000,
            "months": 12
          }
        ],
        "recurrence_km": 3000,
        "recurrence_months": 6
      },
      {
        "maintenance_type": "Cabeçote, cilindro e pistão",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Inspecionar.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Escape e carbonização",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Inspecionar o escapamento e depósitos.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Folga de válvulas",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar a folga, sem confundir com a periodicidade da vela.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Amortecedores",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Inspecionar dianteira e traseira.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Cavaletes",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar e lubrificar.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Balança traseira - lubrificação",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar e lubrificar o garfo traseiro.",
        "schedule_milestones": [
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Marcha lenta",
        "interval_km": 6000,
        "interval_days": 360,
        "notes": "Verificar e ajustar.",
        "schedule_milestones": [
          {
            "km": 1000,
            "months": 6
          },
          {
            "km": 6000,
            "months": 18
          }
        ],
        "recurrence_km": 6000,
        "recurrence_months": 12
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 12000,
        "interval_days": 720,
        "notes": "Substituir o elemento.",
        "schedule_milestones": [
          {
            "km": 12000,
            "months": 30
          }
        ],
        "recurrence_km": 12000,
        "recurrence_months": 24
      },
      {
        "maintenance_type": "Vela de ignição - troca",
        "interval_km": 12000,
        "interval_days": 720,
        "notes": "Substituir a vela.",
        "schedule_milestones": [
          {
            "km": 12000,
            "months": 30
          }
        ],
        "recurrence_km": 12000,
        "recurrence_months": 24
      },
      {
        "maintenance_type": "Direção - lubrificação",
        "interval_km": 12000,
        "interval_days": 720,
        "notes": "Verificar folga e lubrificar os rolamentos.",
        "schedule_milestones": [
          {
            "km": 12000,
            "months": 30
          }
        ],
        "recurrence_km": 12000,
        "recurrence_months": 24
      },
      {
        "maintenance_type": "Filtro da bomba de combustível",
        "interval_km": 9000,
        "interval_days": 540,
        "notes": "Substituir o filtro.",
        "schedule_milestones": [
          {
            "km": 9000,
            "months": 24
          }
        ],
        "recurrence_km": 9000,
        "recurrence_months": 18
      },
      {
        "maintenance_type": "Óleo da suspensão dianteira",
        "interval_km": 15000,
        "interval_days": null,
        "notes": "Trocar a cada 15.000 km; a linha não informa prazo em meses.",
        "schedule_milestones": [
          {
            "km": 15000,
            "months": null
          }
        ],
        "recurrence_km": 15000,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Mangueiras, líquido e vedações do arrefecimento",
        "interval_km": null,
        "interval_days": 1080,
        "notes": "Substituir o conjunto indicado pelo manual a cada três anos.",
        "schedule_milestones": [
          {
            "km": null,
            "months": 36
          }
        ],
        "recurrence_km": null,
        "recurrence_months": 36
      },
      {
        "maintenance_type": "Corrente de transmissão",
        "interval_km": 500,
        "interval_days": null,
        "notes": "Inspecionar, limpar, lubrificar e ajustar também após chuva ou lavagem.",
        "schedule_milestones": [
          {
            "km": 500,
            "months": null
          }
        ],
        "recurrence_km": 500,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus - pressão",
        "interval_km": null,
        "interval_days": 7,
        "notes": "Conferir semanalmente; inspeções antes de pilotar continuam obrigatórias.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rodas - inspeção semanal",
        "interval_km": null,
        "interval_days": 7,
        "notes": "Examinar rodas de liga leve quanto a danos.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      }
    ]
  },
  {
    "id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafd023",
    "model_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe023",
    "brand": "Dafra",
    "model": "Cruisym 150",
    "variant": "Scooter",
    "engine_cc": 150,
    "year_from": 2025,
    "year_to": 2026,
    "generation": "PROMOT 5; edição REV-05/2026",
    "is_exact_schedule": false,
    "source_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafd223",
    "official_url": "https://daframotos.com.br/documentos/pos-vendas-dafra-motos-manual-proprietario-cruisym-150-2025-em-diante.pdf",
    "document_version": "80503-T46-301 REV-05/2026",
    "page_reference": "Programa preventivo, p. 73-75 (PDF p. 74-76)",
    "coverage_notes": "O portal identifica modelo 2025 em diante; cobertura mantida nos anos 2025/2026 já existentes. Tabela conferida, mas há conflito: primeira revisão por seis meses na tabela e um mês na narrativa da p. 75. Não gera agenda automática até esclarecimento oficial. Condições severas exigem manutenção mais frequente.",
    "items": [
      {
        "maintenance_type": "Óleo do motor",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Troca nos marcos 1.000, 3.000, 6.000 km e seguintes; tabela diz 6 meses na primeira revisão, narrativa p. 75 diz um mês: confirmar com a Dafra.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de óleo - tela",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Limpar na troca de óleo.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - inspeção",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar o elemento.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 6000,
        "interval_days": null,
        "notes": "Substituir o elemento.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Óleo da transmissão",
        "interval_km": 6000,
        "interval_days": null,
        "notes": "Substituir.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Correia CVT - inspeção",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar a correia.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Correia CVT - troca",
        "interval_km": 18000,
        "interval_days": null,
        "notes": "Substituir a correia.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Polias CVT",
        "interval_km": 6000,
        "interval_days": null,
        "notes": "Verificar e lubrificar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Vela - inspeção",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Examinar e ajustar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Vela - troca",
        "interval_km": 12000,
        "interval_days": null,
        "notes": "Substituir.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Folga de válvulas",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar e ajustar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Freios - inspeção",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Inspecionar sistema e pastilhas.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fluido de freio",
        "interval_km": null,
        "interval_days": 365,
        "notes": "Trocar anualmente.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Líquido de arrefecimento",
        "interval_km": null,
        "interval_days": 1095,
        "notes": "Trocar a cada três anos.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Óleo da suspensão dianteira",
        "interval_km": 15000,
        "interval_days": 365,
        "notes": "Trocar aos 15.000 km ou 12 meses.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus - pressão",
        "interval_km": 1000,
        "interval_days": null,
        "notes": "Conferir a cada 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rodas",
        "interval_km": null,
        "interval_days": 7,
        "notes": "Examinar semanalmente.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Bateria",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Inspecionar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar e ajustar rolamentos.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - lubrificação",
        "interval_km": 12000,
        "interval_days": null,
        "notes": "Verificar e lubrificar rolamentos.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Vazamentos da transmissão e motor",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Inspecionar estanqueidade.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Alimentação de combustível",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Examinar linhas, tanque e pré-filtro.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Acelerador - inspeção",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Examinar acionamento e cabo.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Acelerador - lubrificação",
        "interval_km": 12000,
        "interval_days": null,
        "notes": "Verificar e lubrificar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fixações",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Inspecionar porcas e parafusos.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Escape",
        "interval_km": 6000,
        "interval_days": null,
        "notes": "A coluna A Cada diz 6.000 km, embora haja marcas em todas as revisões: confirmar interpretação com a Dafra.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Comando e ignição",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Inspecionar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Suspensão",
        "interval_km": 6000,
        "interval_days": null,
        "notes": "Inspecionar; também marcada revisão inicial.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Cavaletes",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar e lubrificar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Arrefecimento - inspeção",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Examinar nível, ventoinha e tubulação.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Iluminação",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar funcionamento.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      }
    ]
  },
  {
    "id": "58785b7d-49b1-5da3-958d-834f21623039",
    "model_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe040",
    "new_model": null,
    "brand": "KTM",
    "model": "200 Duke",
    "variant": "Naked",
    "engine_cc": 200,
    "year_from": 2017,
    "year_to": 2017,
    "generation": "Códigos BR: F4140Q1, F4140Q2",
    "is_exact_schedule": false,
    "source_id": "5c151e3d-53dd-579b-97d2-0eb32e3f8d35",
    "official_url": "https://azwecdnepstoragewebsiteuploads.azureedge.net/17_3213562_pt_OM.pdf",
    "document_version": "17_3213562_pt_OM; ano-modelo 2017",
    "page_reference": "Plano de serviço, p. 72-74 (PDF p. 74-76); modelos BR na apresentação",
    "coverage_notes": "Documento oficial selecionado pelo portal KTM para 200 Duke BR 2017; cobre somente os códigos F4140Q1, F4140Q2. Transcrição conferida. Agenda automática pendente: revisão única aos 1.000 km coexistindo com ciclos de 7.500 km e 12 meses exige eixo de tempo independente, sem inferir fase pelo hodômetro. Confirme atualizações locais com a autorizada; não cobre outras gerações ou mercados.",
    "items": [
      {
        "maintenance_type": "Óleo e filtros do motor",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Trocar óleo e filtro; limpar tela(s). Também há revisão única aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Freios - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar discos, pastilhas, fixações, mangueiras e nível do fluido. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar estado e pressão. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Suspensão - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Procurar vazamentos no amortecedor e garfo. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Corrente - tensão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar tensão. Também aos 1.000 km; cuidados de uso diário seguem o manual.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar folga. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Arrefecimento - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Conferir nível e ventilador. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Elétrica e diagnóstico",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar sistema elétrico e falhas; oficina autorizada. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Cabos e mangueiras",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar instalação, danos e estanqueidade. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fixações e articulações",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar aperto e lubrificar peças móveis. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Verificação final da revisão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Teste funcional, indicador de serviço e registro na rede. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Substituir elemento e limpar caixa.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Válvulas e vela",
        "interval_km": 15000,
        "interval_days": null,
        "notes": "Inspecionar folga e trocar vela.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fluido de freio",
        "interval_km": null,
        "interval_days": 730,
        "notes": "Trocar nos dois freios a cada 24 meses.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Líquido de arrefecimento",
        "interval_km": null,
        "interval_days": 1460,
        "notes": "Trocar a cada 48 meses; classificado como recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Quadro e balança",
        "interval_km": 30000,
        "interval_days": null,
        "notes": "Inspecionar quadro e braço oscilante; em 2023 a tabela muda para 15.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rolamentos de roda e balança",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Inspecionar folgas. Recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Válvulas - revisão inicial",
        "interval_km": 1000,
        "interval_days": null,
        "notes": "Verificação única aos 1.000 km; sem repetição nesta linha. Não converter em recorrência de 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      }
    ]
  },
  {
    "id": "b3abfd2c-2841-58eb-9a75-b04c0d936b5d",
    "model_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe040",
    "new_model": null,
    "brand": "KTM",
    "model": "200 Duke",
    "variant": "Naked",
    "engine_cc": 200,
    "year_from": 2018,
    "year_to": 2018,
    "generation": "Códigos BR: F4140R1, F4140R2",
    "is_exact_schedule": false,
    "source_id": "be137ce0-6b45-51cb-8f0f-6c1922448169",
    "official_url": "https://azwecdnepstoragewebsiteuploads.azureedge.net/18_3213780_pt_OM.pdf",
    "document_version": "18_3213780_pt_OM; ano-modelo 2018",
    "page_reference": "Plano de serviço, p. 94-97 (PDF p. 96-99); modelos BR na apresentação",
    "coverage_notes": "Documento oficial selecionado pelo portal KTM para 200 Duke BR 2018; cobre somente os códigos F4140R1, F4140R2. Transcrição conferida. Agenda automática pendente: revisão única aos 1.000 km coexistindo com ciclos de 7.500 km e 12 meses exige eixo de tempo independente, sem inferir fase pelo hodômetro. Confirme atualizações locais com a autorizada; não cobre outras gerações ou mercados.",
    "items": [
      {
        "maintenance_type": "Óleo e filtros do motor",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Trocar óleo e filtro; limpar tela(s). Também há revisão única aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Freios - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar discos, pastilhas, fixações, mangueiras e nível do fluido. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar estado e pressão. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Suspensão - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Procurar vazamentos no amortecedor e garfo. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Corrente - tensão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar tensão. Também aos 1.000 km; cuidados de uso diário seguem o manual.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar folga. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Arrefecimento - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Conferir nível e ventilador. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Elétrica e diagnóstico",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar sistema elétrico e falhas; oficina autorizada. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Cabos e mangueiras",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar instalação, danos e estanqueidade. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fixações e articulações",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar aperto e lubrificar peças móveis. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Verificação final da revisão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Teste funcional, indicador de serviço e registro na rede. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Substituir elemento e limpar caixa.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Válvulas e vela",
        "interval_km": 15000,
        "interval_days": null,
        "notes": "Inspecionar folga e trocar vela.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fluido de freio",
        "interval_km": null,
        "interval_days": 730,
        "notes": "Trocar nos dois freios a cada 24 meses.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Líquido de arrefecimento",
        "interval_km": null,
        "interval_days": 1460,
        "notes": "Trocar a cada 48 meses; classificado como recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Quadro e balança",
        "interval_km": 30000,
        "interval_days": null,
        "notes": "Inspecionar quadro e braço oscilante; em 2023 a tabela muda para 15.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rolamentos de roda e balança",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Inspecionar folgas. Recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Válvulas - revisão inicial",
        "interval_km": 1000,
        "interval_days": null,
        "notes": "Verificação única aos 1.000 km; sem repetição nesta linha. Não converter em recorrência de 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      }
    ]
  },
  {
    "id": "56f0c7c6-28c9-5794-937b-4ef6bb54d3f1",
    "model_id": "89ee20c5-b878-5b93-8728-7faad8e09511",
    "new_model": {
      "id": "89ee20c5-b878-5b93-8728-7faad8e09511",
      "brand": "KTM",
      "model_name": "200 Duke",
      "variant": "BR F4140T2/T3",
      "display_name": "200 Duke (BR F4140T2/T3)",
      "engine_cc": 200
    },
    "brand": "KTM",
    "model": "200 Duke",
    "variant": "BR F4140T2/T3",
    "engine_cc": 200,
    "year_from": 2020,
    "year_to": 2020,
    "generation": "Códigos BR: F4140T2, F4140T3",
    "is_exact_schedule": false,
    "source_id": "e4e502fe-8eb2-5df2-a400-0c0e59e2231d",
    "official_url": "https://azwecdnepstoragewebsiteuploads.azureedge.net/20_3214119_pt_OM.pdf",
    "document_version": "20_3214119_pt_OM; ano-modelo 2020",
    "page_reference": "Plano de serviço, p. 95-98 (PDF p. 97-100); modelos BR na apresentação",
    "coverage_notes": "Documento oficial selecionado pelo portal KTM para 200 Duke BR 2020; cobre somente os códigos F4140T2, F4140T3. Transcrição conferida. Agenda automática pendente: revisão única aos 1.000 km coexistindo com ciclos de 7.500 km e 12 meses exige eixo de tempo independente, sem inferir fase pelo hodômetro. Confirme atualizações locais com a autorizada; não cobre outras gerações ou mercados.",
    "items": [
      {
        "maintenance_type": "Óleo e filtros do motor",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Trocar óleo e filtro; limpar tela(s). Também há revisão única aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Freios - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar discos, pastilhas, fixações, mangueiras e nível do fluido. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar estado e pressão. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Suspensão - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Procurar vazamentos no amortecedor e garfo. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Corrente - tensão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar tensão. Também aos 1.000 km; cuidados de uso diário seguem o manual.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar folga. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Arrefecimento - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Conferir nível e ventilador. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Elétrica e diagnóstico",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar sistema elétrico e falhas; oficina autorizada. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Cabos e mangueiras",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar instalação, danos e estanqueidade. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fixações e articulações",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar aperto e lubrificar peças móveis. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Verificação final da revisão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Teste funcional, indicador de serviço e registro na rede. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Substituir elemento e limpar caixa.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Válvulas e vela",
        "interval_km": 15000,
        "interval_days": null,
        "notes": "Inspecionar folga e trocar vela.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fluido de freio",
        "interval_km": null,
        "interval_days": 730,
        "notes": "Trocar nos dois freios a cada 24 meses.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Líquido de arrefecimento",
        "interval_km": null,
        "interval_days": 1460,
        "notes": "Trocar a cada 48 meses; classificado como recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Quadro e balança",
        "interval_km": 30000,
        "interval_days": null,
        "notes": "Inspecionar quadro e braço oscilante; em 2023 a tabela muda para 15.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rolamentos de roda e balança",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Inspecionar folgas. Recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      }
    ]
  },
  {
    "id": "8e3322ab-06a5-59c6-a4e8-6d3bb8580371",
    "model_id": "0dea3b14-cb14-5757-9666-cc9cb23b08c5",
    "new_model": {
      "id": "0dea3b14-cb14-5757-9666-cc9cb23b08c5",
      "brand": "KTM",
      "model_name": "200 Duke",
      "variant": "BR F4140T5/T6/T7",
      "display_name": "200 Duke (BR F4140T5/T6/T7)",
      "engine_cc": 200
    },
    "brand": "KTM",
    "model": "200 Duke",
    "variant": "BR F4140T5/T6/T7",
    "engine_cc": 200,
    "year_from": 2020,
    "year_to": 2020,
    "generation": "Códigos BR: F4140T5, F4140T6, F4140T7",
    "is_exact_schedule": false,
    "source_id": "d436d0ff-c744-5348-9e2b-77427c26b78d",
    "official_url": "https://azwecdnepstoragewebsiteuploads.azureedge.net/20_3214120_pt_OM.pdf",
    "document_version": "20_3214120_pt_OM; ano-modelo 2020",
    "page_reference": "Plano de serviço, p. 95-98 (PDF p. 97-100); modelos BR na apresentação",
    "coverage_notes": "Documento oficial selecionado pelo portal KTM para 200 Duke BR 2020; cobre somente os códigos F4140T5, F4140T6, F4140T7. Transcrição conferida. Agenda automática pendente: revisão única aos 1.000 km coexistindo com ciclos de 7.500 km e 12 meses exige eixo de tempo independente, sem inferir fase pelo hodômetro. Confirme atualizações locais com a autorizada; não cobre outras gerações ou mercados.",
    "items": [
      {
        "maintenance_type": "Óleo e filtros do motor",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Trocar óleo e filtro; limpar tela(s). Também há revisão única aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Freios - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar discos, pastilhas, fixações, mangueiras e nível do fluido. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar estado e pressão. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Suspensão - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Procurar vazamentos no amortecedor e garfo. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Corrente - tensão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar tensão. Também aos 1.000 km; cuidados de uso diário seguem o manual.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar folga. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Arrefecimento - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Conferir nível e ventilador. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Elétrica e diagnóstico",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar sistema elétrico e falhas; oficina autorizada. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Cabos e mangueiras",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar instalação, danos e estanqueidade. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fixações e articulações",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar aperto e lubrificar peças móveis. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Verificação final da revisão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Teste funcional, indicador de serviço e registro na rede. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Substituir elemento e limpar caixa.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Válvulas e vela",
        "interval_km": 15000,
        "interval_days": null,
        "notes": "Inspecionar folga e trocar vela.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fluido de freio",
        "interval_km": null,
        "interval_days": 730,
        "notes": "Trocar nos dois freios a cada 24 meses.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Líquido de arrefecimento",
        "interval_km": null,
        "interval_days": 1460,
        "notes": "Trocar a cada 48 meses; classificado como recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Quadro e balança",
        "interval_km": 30000,
        "interval_days": null,
        "notes": "Inspecionar quadro e braço oscilante; em 2023 a tabela muda para 15.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rolamentos de roda e balança",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Inspecionar folgas. Recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      }
    ]
  },
  {
    "id": "fe73a08e-dc3a-51dd-99ab-be3139618827",
    "model_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe041",
    "new_model": null,
    "brand": "KTM",
    "model": "390 Duke",
    "variant": "Naked",
    "engine_cc": 373,
    "year_from": 2018,
    "year_to": 2018,
    "generation": "Códigos BR: F4340R1, F4340R2",
    "is_exact_schedule": false,
    "source_id": "e72d7a09-12f7-5fd5-8e41-dca868f09a17",
    "official_url": "https://azwecdnepstoragewebsiteuploads.azureedge.net/18_3213782_pt_OM.pdf",
    "document_version": "18_3213782_pt_OM; ano-modelo 2018",
    "page_reference": "Plano de serviço, p. 112-115 (PDF p. 114-117); modelos BR na apresentação",
    "coverage_notes": "Documento oficial selecionado pelo portal KTM para 390 Duke BR 2018; cobre somente os códigos F4340R1, F4340R2. Transcrição conferida. Agenda automática pendente: revisão única aos 1.000 km coexistindo com ciclos de 7.500 km e 12 meses exige eixo de tempo independente, sem inferir fase pelo hodômetro. Confirme atualizações locais com a autorizada; não cobre outras gerações ou mercados.",
    "items": [
      {
        "maintenance_type": "Óleo e filtros do motor",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Trocar óleo e filtro; limpar tela(s). Também há revisão única aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Freios - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar discos, pastilhas, fixações, mangueiras e nível do fluido. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar estado e pressão. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Suspensão - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Procurar vazamentos no amortecedor e garfo. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Corrente - tensão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar tensão. Também aos 1.000 km; cuidados de uso diário seguem o manual.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar folga. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Arrefecimento - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Conferir nível e ventilador. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Elétrica e diagnóstico",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar sistema elétrico e falhas; oficina autorizada. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Cabos e mangueiras",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar instalação, danos e estanqueidade. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fixações e articulações",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar aperto e lubrificar peças móveis. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Verificação final da revisão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Teste funcional, indicador de serviço e registro na rede. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Substituir elemento e limpar caixa.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Válvulas e vela",
        "interval_km": 15000,
        "interval_days": null,
        "notes": "Inspecionar folga e trocar vela.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fluido de freio",
        "interval_km": null,
        "interval_days": 730,
        "notes": "Trocar nos dois freios a cada 24 meses.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Líquido de arrefecimento",
        "interval_km": null,
        "interval_days": 1460,
        "notes": "Trocar a cada 48 meses; classificado como recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Quadro e balança",
        "interval_km": 30000,
        "interval_days": null,
        "notes": "Inspecionar quadro e braço oscilante; em 2023 a tabela muda para 15.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rolamentos de roda e balança",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Inspecionar folgas. Recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Válvulas - revisão inicial",
        "interval_km": 1000,
        "interval_days": null,
        "notes": "Verificação única aos 1.000 km; sem repetição nesta linha. Não converter em recorrência de 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      }
    ]
  },
  {
    "id": "bb4a269c-96b5-5d1d-999b-77062271cd4c",
    "model_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe041",
    "new_model": null,
    "brand": "KTM",
    "model": "390 Duke",
    "variant": "Naked",
    "engine_cc": 373,
    "year_from": 2019,
    "year_to": 2019,
    "generation": "Códigos BR: F4340S1, F4340S2",
    "is_exact_schedule": false,
    "source_id": "ab9bf560-457a-523b-af3b-d93a4b0b0974",
    "official_url": "https://azwecdnepstoragewebsiteuploads.azureedge.net/19_3213939_pt_OM.pdf",
    "document_version": "19_3213939_pt_OM; ano-modelo 2019",
    "page_reference": "Plano de serviço, p. 114-117 (PDF p. 116-119); modelos BR na apresentação",
    "coverage_notes": "Documento oficial selecionado pelo portal KTM para 390 Duke BR 2019; cobre somente os códigos F4340S1, F4340S2. Transcrição conferida. Agenda automática pendente: revisão única aos 1.000 km coexistindo com ciclos de 7.500 km e 12 meses exige eixo de tempo independente, sem inferir fase pelo hodômetro. Confirme atualizações locais com a autorizada; não cobre outras gerações ou mercados.",
    "items": [
      {
        "maintenance_type": "Óleo e filtros do motor",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Trocar óleo e filtro; limpar tela(s). Também há revisão única aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Freios - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar discos, pastilhas, fixações, mangueiras e nível do fluido. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar estado e pressão. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Suspensão - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Procurar vazamentos no amortecedor e garfo. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Corrente - tensão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar tensão. Também aos 1.000 km; cuidados de uso diário seguem o manual.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar folga. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Arrefecimento - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Conferir nível e ventilador. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Elétrica e diagnóstico",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar sistema elétrico e falhas; oficina autorizada. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Cabos e mangueiras",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar instalação, danos e estanqueidade. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fixações e articulações",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar aperto e lubrificar peças móveis. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Verificação final da revisão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Teste funcional, indicador de serviço e registro na rede. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Substituir elemento e limpar caixa.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Válvulas e vela",
        "interval_km": 15000,
        "interval_days": null,
        "notes": "Inspecionar folga e trocar vela.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fluido de freio",
        "interval_km": null,
        "interval_days": 730,
        "notes": "Trocar nos dois freios a cada 24 meses.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Líquido de arrefecimento",
        "interval_km": null,
        "interval_days": 1460,
        "notes": "Trocar a cada 48 meses; classificado como recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Quadro e balança",
        "interval_km": 30000,
        "interval_days": null,
        "notes": "Inspecionar quadro e braço oscilante; em 2023 a tabela muda para 15.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rolamentos de roda e balança",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Inspecionar folgas. Recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      }
    ]
  },
  {
    "id": "e39e9ff8-4441-55b3-bcd1-8d80cbc75a04",
    "model_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe041",
    "new_model": null,
    "brand": "KTM",
    "model": "390 Duke",
    "variant": "Naked",
    "engine_cc": 373,
    "year_from": 2020,
    "year_to": 2020,
    "generation": "Códigos BR: F4340T1, F4340T2",
    "is_exact_schedule": false,
    "source_id": "d62373b7-b7f4-52da-a37c-56cca3a52ed4",
    "official_url": "https://azwecdnepstoragewebsiteuploads.azureedge.net/20_3214122_pt_OM.pdf",
    "document_version": "20_3214122_pt_OM; ano-modelo 2020",
    "page_reference": "Plano de serviço, p. 114-117 (PDF p. 116-119); modelos BR na apresentação",
    "coverage_notes": "Documento oficial selecionado pelo portal KTM para 390 Duke BR 2020; cobre somente os códigos F4340T1, F4340T2. Transcrição conferida. Agenda automática pendente: revisão única aos 1.000 km coexistindo com ciclos de 7.500 km e 12 meses exige eixo de tempo independente, sem inferir fase pelo hodômetro. Confirme atualizações locais com a autorizada; não cobre outras gerações ou mercados.",
    "items": [
      {
        "maintenance_type": "Óleo e filtros do motor",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Trocar óleo e filtro; limpar tela(s). Também há revisão única aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Freios - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar discos, pastilhas, fixações, mangueiras e nível do fluido. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar estado e pressão. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Suspensão - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Procurar vazamentos no amortecedor e garfo. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Corrente - tensão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar tensão. Também aos 1.000 km; cuidados de uso diário seguem o manual.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar folga. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Arrefecimento - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Conferir nível e ventilador. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Elétrica e diagnóstico",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar sistema elétrico e falhas; oficina autorizada. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Cabos e mangueiras",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar instalação, danos e estanqueidade. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fixações e articulações",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar aperto e lubrificar peças móveis. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Verificação final da revisão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Teste funcional, indicador de serviço e registro na rede. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Substituir elemento e limpar caixa.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Válvulas e vela",
        "interval_km": 15000,
        "interval_days": null,
        "notes": "Inspecionar folga e trocar vela.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fluido de freio",
        "interval_km": null,
        "interval_days": 730,
        "notes": "Trocar nos dois freios a cada 24 meses.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Líquido de arrefecimento",
        "interval_km": null,
        "interval_days": 1460,
        "notes": "Trocar a cada 48 meses; classificado como recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Quadro e balança",
        "interval_km": 30000,
        "interval_days": null,
        "notes": "Inspecionar quadro e braço oscilante; em 2023 a tabela muda para 15.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rolamentos de roda e balança",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Inspecionar folgas. Recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      }
    ]
  },
  {
    "id": "c446a91a-3d22-5db7-b811-067f259fc440",
    "model_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe041",
    "new_model": null,
    "brand": "KTM",
    "model": "390 Duke",
    "variant": "Naked",
    "engine_cc": 373,
    "year_from": 2021,
    "year_to": 2021,
    "generation": "Códigos BR: F4340U1, F4340U2",
    "is_exact_schedule": false,
    "source_id": "b2eba8cc-d868-5a65-ae95-cdcd1ab4275e",
    "official_url": "https://azwecdnepstoragewebsiteuploads.azureedge.net/21_3214321_pt_OM.pdf",
    "document_version": "21_3214321_pt_OM; ano-modelo 2021",
    "page_reference": "Plano de serviço, p. 53-54 (PDF p. 55-56); modelos BR na apresentação",
    "coverage_notes": "Documento oficial selecionado pelo portal KTM para 390 Duke BR 2021; cobre somente os códigos F4340U1, F4340U2. Transcrição conferida. Agenda automática pendente: revisão única aos 1.000 km coexistindo com ciclos de 7.500 km e 12 meses exige eixo de tempo independente, sem inferir fase pelo hodômetro. Confirme atualizações locais com a autorizada; não cobre outras gerações ou mercados.",
    "items": [
      {
        "maintenance_type": "Óleo e filtros do motor",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Trocar óleo e filtro; limpar tela(s). Também há revisão única aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Freios - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar discos, pastilhas, fixações, mangueiras e nível do fluido. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar estado e pressão. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Suspensão - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Procurar vazamentos no amortecedor e garfo. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Corrente - tensão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar tensão. Também aos 1.000 km; cuidados de uso diário seguem o manual.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar folga. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Arrefecimento - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Conferir nível e ventilador. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Elétrica e diagnóstico",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar sistema elétrico e falhas; oficina autorizada. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Cabos e mangueiras",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar instalação, danos e estanqueidade. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fixações e articulações",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar aperto e lubrificar peças móveis. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Verificação final da revisão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Teste funcional, indicador de serviço e registro na rede. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Substituir elemento e limpar caixa.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Válvulas e vela",
        "interval_km": 15000,
        "interval_days": null,
        "notes": "Inspecionar folga e trocar vela.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fluido de freio",
        "interval_km": null,
        "interval_days": 730,
        "notes": "Trocar nos dois freios a cada 24 meses.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Líquido de arrefecimento",
        "interval_km": null,
        "interval_days": 1460,
        "notes": "Trocar a cada 48 meses; classificado como recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Quadro e balança",
        "interval_km": 30000,
        "interval_days": null,
        "notes": "Inspecionar quadro e braço oscilante; em 2023 a tabela muda para 15.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rolamentos de roda e balança",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Inspecionar folgas. Recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Sensor do comando",
        "interval_km": 15000,
        "interval_days": 365,
        "notes": "Programar sensor do comando: também há marca na revisão inicial de 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      }
    ]
  },
  {
    "id": "ae840847-9d13-5405-b8d5-85fd4d1e7424",
    "model_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe041",
    "new_model": null,
    "brand": "KTM",
    "model": "390 Duke",
    "variant": "Naked",
    "engine_cc": 373,
    "year_from": 2022,
    "year_to": 2022,
    "generation": "Códigos BR: F4340V1",
    "is_exact_schedule": false,
    "source_id": "b2def8b3-3320-520c-a5ea-c2af7c1ffe3d",
    "official_url": "https://azwecdnepstoragewebsiteuploads.azureedge.net/22_3214574_pt_OM.pdf",
    "document_version": "22_3214574_pt_OM; ano-modelo 2022",
    "page_reference": "Plano de serviço, p. 53-54 (PDF p. 55-56); modelos BR na apresentação",
    "coverage_notes": "Documento oficial selecionado pelo portal KTM para 390 Duke BR 2022; cobre somente os códigos F4340V1. Transcrição conferida. Agenda automática pendente: revisão única aos 1.000 km coexistindo com ciclos de 7.500 km e 12 meses exige eixo de tempo independente, sem inferir fase pelo hodômetro. Confirme atualizações locais com a autorizada; não cobre outras gerações ou mercados.",
    "items": [
      {
        "maintenance_type": "Óleo e filtros do motor",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Trocar óleo e filtro; limpar tela(s). Também há revisão única aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Freios - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar discos, pastilhas, fixações, mangueiras e nível do fluido. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar estado e pressão. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Suspensão - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Procurar vazamentos no amortecedor e garfo. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Corrente - tensão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar tensão. Também aos 1.000 km; cuidados de uso diário seguem o manual.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar folga. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Arrefecimento - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Conferir nível e ventilador. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Elétrica e diagnóstico",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar sistema elétrico e falhas; oficina autorizada. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Cabos e mangueiras",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar instalação, danos e estanqueidade. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fixações e articulações",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar aperto e lubrificar peças móveis. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Verificação final da revisão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Teste funcional, indicador de serviço e registro na rede. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Substituir elemento e limpar caixa.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Válvulas e vela",
        "interval_km": 15000,
        "interval_days": null,
        "notes": "Inspecionar folga e trocar vela.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fluido de freio",
        "interval_km": null,
        "interval_days": 730,
        "notes": "Trocar nos dois freios a cada 24 meses.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Líquido de arrefecimento",
        "interval_km": null,
        "interval_days": 1460,
        "notes": "Trocar a cada 48 meses; classificado como recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Quadro e balança",
        "interval_km": 30000,
        "interval_days": null,
        "notes": "Inspecionar quadro e braço oscilante; em 2023 a tabela muda para 15.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rolamentos de roda e balança",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Inspecionar folgas. Recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      }
    ]
  },
  {
    "id": "589bd09f-05e1-52f7-8133-4b87d6fcbe80",
    "model_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe041",
    "new_model": null,
    "brand": "KTM",
    "model": "390 Duke",
    "variant": "Naked",
    "engine_cc": 373,
    "year_from": 2023,
    "year_to": 2023,
    "generation": "Códigos BR: F4340W1, F4340W3",
    "is_exact_schedule": false,
    "source_id": "9576f1ea-d929-5d31-a909-a73443280d94",
    "official_url": "https://azwecdnepstoragewebsiteuploads.azureedge.net/23_3214790_pt_OM.pdf",
    "document_version": "23_3214790_pt_OM; ano-modelo 2023",
    "page_reference": "Plano de serviço, p. 53-54 (PDF p. 55-56); modelos BR na apresentação",
    "coverage_notes": "Documento oficial selecionado pelo portal KTM para 390 Duke BR 2023; cobre somente os códigos F4340W1, F4340W3. Transcrição conferida. Agenda automática pendente: revisão única aos 1.000 km coexistindo com ciclos de 7.500 km e 12 meses exige eixo de tempo independente, sem inferir fase pelo hodômetro. Confirme atualizações locais com a autorizada; não cobre outras gerações ou mercados.",
    "items": [
      {
        "maintenance_type": "Óleo e filtros do motor",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Trocar óleo e filtro; limpar tela(s). Também há revisão única aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Freios - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar discos, pastilhas, fixações, mangueiras e nível do fluido. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar estado e pressão. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Suspensão - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Procurar vazamentos no amortecedor e garfo. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Corrente - tensão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar tensão. Também aos 1.000 km; cuidados de uso diário seguem o manual.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar folga. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Arrefecimento - inspeção",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Conferir nível e ventilador. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Elétrica e diagnóstico",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Verificar sistema elétrico e falhas; oficina autorizada. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Cabos e mangueiras",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar instalação, danos e estanqueidade. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fixações e articulações",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Examinar aperto e lubrificar peças móveis. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Verificação final da revisão",
        "interval_km": 7500,
        "interval_days": 365,
        "notes": "Teste funcional, indicador de serviço e registro na rede. Também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Substituir elemento e limpar caixa.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Válvulas e vela",
        "interval_km": 15000,
        "interval_days": null,
        "notes": "Inspecionar folga e trocar vela.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fluido de freio",
        "interval_km": null,
        "interval_days": 730,
        "notes": "Trocar nos dois freios a cada 24 meses.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Líquido de arrefecimento",
        "interval_km": null,
        "interval_days": 1460,
        "notes": "Trocar a cada 48 meses; classificado como recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Quadro e balança",
        "interval_km": 15000,
        "interval_days": null,
        "notes": "Inspecionar quadro e braço oscilante; em 2023 a tabela muda para 15.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rolamentos de roda e balança",
        "interval_km": 7500,
        "interval_days": null,
        "notes": "Inspecionar folgas. Recomendado nos manuais anteriores a 2023.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      }
    ]
  },
  {
    "id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafd030",
    "model_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe030",
    "brand": "Shineray",
    "model": "Jet 50S",
    "variant": "Ciclomotor",
    "engine_cc": 49,
    "year_from": 2023,
    "year_to": 2024,
    "generation": "Manual Jet 50S, publicação 2024",
    "is_exact_schedule": false,
    "source_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafd230",
    "official_url": "https://www.shineray.com.br/wp-content/uploads/2024/04/MANUAL-DE-PROPRIETARIO-JET50S.pdf",
    "document_version": "Manual Jet 50S, publicação 2024",
    "page_reference": "Plano de manutenção, p. 58-60 (PDF p. 58-60); notas sobre uso severo e troca de fluidos na última página do plano",
    "coverage_notes": "Tabela oficial conferida. Anos de edição, copyright e publicação não comprovam todos os anos-modelo abrangidos: os anos selecionáveis anteriores são preservados como linha orientativa, sem agenda automática. A linha de eixos/rodas tem marcas que não coincidem com a coluna A Cada e não foi convertida em intervalo automático. Uso severo exige frequência definida pela autorizada.",
    "items": [
      {
        "maintenance_type": "Óleo do motor",
        "interval_km": 1000,
        "interval_days": null,
        "notes": "Substituir; reduzir intervalos em uso severo conforme autorizada.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Corrente de transmissão",
        "interval_km": 500,
        "interval_days": 7,
        "notes": "Verificar, ajustar e lubrificar; menor prazo vence.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus",
        "interval_km": 1000,
        "interval_days": 7,
        "notes": "Verificar e calibrar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 1000,
        "interval_days": 7,
        "notes": "Verificar a caixa de direção.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - lubrificação",
        "interval_km": 9000,
        "interval_days": null,
        "notes": "Lubrificar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - limpeza",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Há marca inicial aos 1.000 km; limpeza e substituição são operações diferentes.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 6000,
        "interval_days": null,
        "notes": "Substituir.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Vela - inspeção",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar; também na primeira revisão.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Vela - troca",
        "interval_km": 9000,
        "interval_days": null,
        "notes": "Substituir.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de óleo - inspeção",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Sistema de freio",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Inspecionar; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pastilhas e luz de freio",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Examinar pastilhas e interruptor.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fluido de freio - nível",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Conferir o nível; não é intervalo de troca.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Bateria e fusível",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Suspensão - inspeção",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Examinar dianteira e traseira; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Óleo da suspensão dianteira",
        "interval_km": 9000,
        "interval_days": null,
        "notes": "Substituir.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Cavaletes",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fixações e carenagens",
        "interval_km": 6000,
        "interval_days": null,
        "notes": "Examinar aperto, alinhamento; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rodas",
        "interval_km": 6000,
        "interval_days": null,
        "notes": "Inspecionar alinhamento, folgas e rolamentos; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Válvulas",
        "interval_km": 1000,
        "interval_days": null,
        "notes": "Verificar e ajustar; tabelas diferem entre modelos. Não copiar o intervalo da EFI para outras versões.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Carburador",
        "interval_km": 9000,
        "interval_days": null,
        "notes": "Verificar e ajustar o sistema da variante correta.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      }
    ]
  },
  {
    "id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafd031",
    "model_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe031",
    "brand": "Shineray",
    "model": "SHI 175",
    "variant": "Street carburada",
    "engine_cc": 174,
    "year_from": 2022,
    "year_to": 2023,
    "generation": "Manual SHI 175, copyright 2022",
    "is_exact_schedule": false,
    "source_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafd231",
    "official_url": "https://www.shineray.com.br/wp-content/uploads/2024/03/MANUAL-DE-PROPRIETARIO-SHI-175-2.pdf",
    "document_version": "Manual SHI 175, copyright 2022",
    "page_reference": "Plano de manutenção, p. 58-60 (PDF p. 58-60); notas sobre uso severo e troca de fluidos na última página do plano",
    "coverage_notes": "Tabela oficial conferida. Anos de edição, copyright e publicação não comprovam todos os anos-modelo abrangidos: os anos selecionáveis anteriores são preservados como linha orientativa, sem agenda automática. A linha de eixos/rodas tem marcas que não coincidem com a coluna A Cada e não foi convertida em intervalo automático. Uso severo exige frequência definida pela autorizada.",
    "items": [
      {
        "maintenance_type": "Óleo do motor",
        "interval_km": 1000,
        "interval_days": null,
        "notes": "Substituir; reduzir intervalos em uso severo conforme autorizada.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Corrente de transmissão",
        "interval_km": 500,
        "interval_days": 7,
        "notes": "Verificar, ajustar e lubrificar; menor prazo vence.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus",
        "interval_km": 1000,
        "interval_days": 7,
        "notes": "Verificar e calibrar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 1000,
        "interval_days": 7,
        "notes": "Verificar a caixa de direção.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - lubrificação",
        "interval_km": 9000,
        "interval_days": null,
        "notes": "Lubrificar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - limpeza",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Há marca inicial aos 1.000 km; limpeza e substituição são operações diferentes.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 6000,
        "interval_days": null,
        "notes": "Substituir.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Vela - inspeção",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar; também na primeira revisão.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Vela - troca",
        "interval_km": 9000,
        "interval_days": null,
        "notes": "Substituir.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de óleo - inspeção",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Sistema de freio",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Inspecionar; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pastilhas e luz de freio",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Examinar pastilhas e interruptor.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fluido de freio - nível",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Conferir o nível; não é intervalo de troca.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Bateria e fusível",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Suspensão - inspeção",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Examinar dianteira e traseira; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Óleo da suspensão dianteira",
        "interval_km": 9000,
        "interval_days": null,
        "notes": "Substituir.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Cavaletes",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fixações e carenagens",
        "interval_km": 6000,
        "interval_days": null,
        "notes": "Examinar aperto, alinhamento; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rodas",
        "interval_km": 6000,
        "interval_days": null,
        "notes": "Inspecionar alinhamento, folgas e rolamentos; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Válvulas",
        "interval_km": 1000,
        "interval_days": null,
        "notes": "Verificar e ajustar; tabelas diferem entre modelos. Não copiar o intervalo da EFI para outras versões.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Carburador",
        "interval_km": 9000,
        "interval_days": null,
        "notes": "Verificar e ajustar o sistema da variante correta.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      }
    ]
  },
  {
    "id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafd032",
    "model_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe032",
    "brand": "Shineray",
    "model": "SHI 175S EFI",
    "variant": "Street EFI",
    "engine_cc": 174,
    "year_from": 2024,
    "year_to": 2025,
    "generation": "Manual SHI 175S EFI, edição 2025 rev. 003",
    "is_exact_schedule": false,
    "source_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafd232",
    "official_url": "https://www.shineray.com.br/wp-content/uploads/2024/06/2025-MANUAL-DE-PROPRIETARIO-SHI-175S-EFI-REV003.pdf",
    "document_version": "Manual SHI 175S EFI, edição 2025 rev. 003",
    "page_reference": "Plano de manutenção, p. 60-62 (PDF p. 60-62); notas sobre uso severo e troca de fluidos na última página do plano",
    "coverage_notes": "Tabela oficial conferida. Anos de edição, copyright e publicação não comprovam todos os anos-modelo abrangidos: os anos selecionáveis anteriores são preservados como linha orientativa, sem agenda automática. A linha de eixos/rodas tem marcas que não coincidem com a coluna A Cada e não foi convertida em intervalo automático. Uso severo exige frequência definida pela autorizada.",
    "items": [
      {
        "maintenance_type": "Óleo do motor",
        "interval_km": 1000,
        "interval_days": null,
        "notes": "Substituir; reduzir intervalos em uso severo conforme autorizada.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Corrente de transmissão",
        "interval_km": 500,
        "interval_days": 7,
        "notes": "Verificar, ajustar e lubrificar; menor prazo vence.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus",
        "interval_km": 1000,
        "interval_days": 7,
        "notes": "Verificar e calibrar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 1000,
        "interval_days": 7,
        "notes": "Verificar a caixa de direção.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - lubrificação",
        "interval_km": 9000,
        "interval_days": null,
        "notes": "Lubrificar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - limpeza",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Há marca inicial aos 1.000 km; limpeza e substituição são operações diferentes.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 6000,
        "interval_days": null,
        "notes": "Substituir.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Vela - inspeção",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar; também na primeira revisão.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Vela - troca",
        "interval_km": 9000,
        "interval_days": null,
        "notes": "Substituir.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro centrífugo",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Sistema de freio",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Inspecionar; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pastilhas e luz de freio",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Examinar pastilhas e interruptor.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fluido de freio - nível",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Conferir o nível; não é intervalo de troca.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Bateria e fusível",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Suspensão - inspeção",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Examinar dianteira e traseira; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Óleo da suspensão dianteira",
        "interval_km": 9000,
        "interval_days": null,
        "notes": "Substituir.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Cavaletes",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fixações e carenagens",
        "interval_km": 6000,
        "interval_days": null,
        "notes": "Examinar aperto, alinhamento; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rodas",
        "interval_km": 6000,
        "interval_days": null,
        "notes": "Inspecionar alinhamento, folgas e rolamentos; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Válvulas",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar e ajustar; tabelas diferem entre modelos. Não copiar o intervalo da EFI para outras versões.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Alimentação EFI",
        "interval_km": 9000,
        "interval_days": null,
        "notes": "Verificar e ajustar o sistema da variante correta.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      }
    ]
  },
  {
    "id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafd033",
    "model_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe033",
    "brand": "Shineray",
    "model": "Free 150 EFI",
    "variant": "Street",
    "engine_cc": 149,
    "year_from": 2024,
    "year_to": 2025,
    "generation": "Manual Free 150 EFI, edição 2025 rev. 00",
    "is_exact_schedule": false,
    "source_id": "0f0bb40e-0aec-4b09-a3f0-2ddc3cafd233",
    "official_url": "https://www.shineray.com.br/wp-content/uploads/2024/05/2025-MANUAL-DE-PROPRIETARIO-FREE-150-EFI-REV00.pdf",
    "document_version": "Manual Free 150 EFI, edição 2025 rev. 00",
    "page_reference": "Plano de manutenção, p. 60-62 (PDF p. 60-62); notas sobre uso severo e troca de fluidos na última página do plano",
    "coverage_notes": "Tabela oficial conferida. Anos de edição, copyright e publicação não comprovam todos os anos-modelo abrangidos: os anos selecionáveis anteriores são preservados como linha orientativa, sem agenda automática. A linha de eixos/rodas tem marcas que não coincidem com a coluna A Cada e não foi convertida em intervalo automático. Uso severo exige frequência definida pela autorizada.",
    "items": [
      {
        "maintenance_type": "Óleo do motor",
        "interval_km": 1000,
        "interval_days": null,
        "notes": "Substituir; reduzir intervalos em uso severo conforme autorizada.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Corrente de transmissão",
        "interval_km": 500,
        "interval_days": 7,
        "notes": "Verificar, ajustar e lubrificar; menor prazo vence.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pneus",
        "interval_km": 1000,
        "interval_days": 7,
        "notes": "Verificar e calibrar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - inspeção",
        "interval_km": 1000,
        "interval_days": 7,
        "notes": "Verificar a caixa de direção.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Direção - lubrificação",
        "interval_km": 9000,
        "interval_days": null,
        "notes": "Lubrificar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - limpeza",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Há marca inicial aos 1.000 km; limpeza e substituição são operações diferentes.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro de ar - troca",
        "interval_km": 6000,
        "interval_days": null,
        "notes": "Substituir.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Vela - inspeção",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar; também na primeira revisão.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Vela - troca",
        "interval_km": 9000,
        "interval_days": null,
        "notes": "Substituir.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Filtro centrífugo",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Sistema de freio",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Inspecionar; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Pastilhas e luz de freio",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Examinar pastilhas e interruptor.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fluido de freio - nível",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Conferir o nível; não é intervalo de troca.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Bateria e fusível",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Suspensão - inspeção",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Examinar dianteira e traseira; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Óleo da suspensão dianteira",
        "interval_km": 9000,
        "interval_days": null,
        "notes": "Substituir.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Cavaletes",
        "interval_km": 3000,
        "interval_days": null,
        "notes": "Verificar; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Fixações e carenagens",
        "interval_km": 6000,
        "interval_days": null,
        "notes": "Examinar aperto, alinhamento; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Rodas",
        "interval_km": 6000,
        "interval_days": null,
        "notes": "Inspecionar alinhamento, folgas e rolamentos; também aos 1.000 km.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Válvulas",
        "interval_km": 1000,
        "interval_days": null,
        "notes": "Verificar e ajustar; tabelas diferem entre modelos. Não copiar o intervalo da EFI para outras versões.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      },
      {
        "maintenance_type": "Alimentação EFI",
        "interval_km": 9000,
        "interval_days": null,
        "notes": "Verificar e ajustar o sistema da variante correta.",
        "schedule_milestones": [],
        "recurrence_km": null,
        "recurrence_months": null
      }
    ]
  }
]
$catalog$::jsonb;
  entry jsonb;
  maintenance jsonb;
  manual_id uuid;
begin
  for entry in select value from jsonb_array_elements(catalog)
  loop
    if entry->'new_model' is not null and entry->'new_model' <> 'null'::jsonb then
      insert into public.motorcycle_models
        (id, brand, model_name, variant, display_name, engine_cc, country_code, is_visible)
      values
        ((entry->'new_model'->>'id')::uuid, entry->>'brand', entry->>'model',
         entry->>'variant', entry->'new_model'->>'display_name',
         (entry->>'engine_cc')::integer, 'BR', true)
      on conflict (id) do update set
        display_name = excluded.display_name, is_visible = excluded.is_visible;
    end if;

    insert into public.motorcycle_templates
      (id, model_id, brand, model, year_from, year_to, variant, generation,
       engine_cc, country_code, is_exact_schedule, is_catalog_visible)
    values
      ((entry->>'id')::uuid, (entry->>'model_id')::uuid, entry->>'brand',
       entry->>'model', (entry->>'year_from')::integer, (entry->>'year_to')::integer,
       entry->>'variant', entry->>'generation', (entry->>'engine_cc')::integer,
       'BR', (entry->>'is_exact_schedule')::boolean, true)
    on conflict (id) do update set
      model_id = excluded.model_id, brand = excluded.brand, model = excluded.model,
      year_from = excluded.year_from, year_to = excluded.year_to,
      variant = excluded.variant, generation = excluded.generation,
      engine_cc = excluded.engine_cc, country_code = excluded.country_code,
      is_exact_schedule = excluded.is_exact_schedule,
      is_catalog_visible = excluded.is_catalog_visible;

    insert into public.motorcycle_manual_sources
      (id, template_id, official_url, document_version, page_reference,
       last_verified_date, coverage_notes)
    values
      ((entry->>'source_id')::uuid, (entry->>'id')::uuid, entry->>'official_url',
       entry->>'document_version', entry->>'page_reference', date '2026-10-23',
       entry->>'coverage_notes')
    on conflict (template_id) do update set
      official_url = excluded.official_url, document_version = excluded.document_version,
      page_reference = excluded.page_reference, last_verified_date = excluded.last_verified_date,
      coverage_notes = excluded.coverage_notes
    returning id into manual_id;

    insert into public.motorcycle_template_specs (template_id, manual_url)
    values ((entry->>'id')::uuid, entry->>'official_url')
    on conflict (template_id) do update set manual_url = excluded.manual_url;

    insert into public.motorcycle_template_documents
      (template_id, title, document_type, external_url, source_url, notes)
    values
      ((entry->>'id')::uuid, entry->>'document_version', 'owner_manual',
       entry->>'official_url', entry->>'official_url', entry->>'coverage_notes')
    on conflict (template_id, title) do update set
      external_url = excluded.external_url, source_url = excluded.source_url,
      notes = excluded.notes;

    for maintenance in select value from jsonb_array_elements(entry->'items')
    loop
      insert into public.motorcycle_template_maintenance_items
        (template_id, maintenance_type, interval_km, interval_days, notes,
         source_url, manual_source_id, estimated_cost_cents,
         schedule_milestones, recurrence_km, recurrence_months)
      values
        ((entry->>'id')::uuid, maintenance->>'maintenance_type',
         (maintenance->>'interval_km')::integer, (maintenance->>'interval_days')::integer,
         maintenance->>'notes', entry->>'official_url', manual_id, 0,
         maintenance->'schedule_milestones', (maintenance->>'recurrence_km')::integer,
         (maintenance->>'recurrence_months')::integer)
      on conflict (template_id, maintenance_type) do update set
        interval_km = excluded.interval_km, interval_days = excluded.interval_days,
        notes = excluded.notes, source_url = excluded.source_url,
        manual_source_id = excluded.manual_source_id,
        schedule_milestones = excluded.schedule_milestones,
        recurrence_km = excluded.recurrence_km, recurrence_months = excluded.recurrence_months;
    end loop;
  end loop;
end;
$migration$;

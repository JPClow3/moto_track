from __future__ import annotations

from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.forum.models import ForumArticle


class Command(BaseCommand):
    help = "Populates the forum with common motorcycle maintenance articles."

    def handle(self, *args, **options):
        articles = [
            {
                "title": "Como fazer a troca de óleo da Honda CG 160 (2016-2024)",
                "summary": "Um guia passo a passo para realizar a manutenção mais comum da moto mais vendida do Brasil.",
                "body": (
                    "A troca de óleo é a manutenção mais importante para garantir a longevidade do motor da sua Honda CG 160. "
                    "Seja ela Titan, Fan ou Start, o procedimento é o mesmo.\n\n"
                    "### Materiais Necessários:\n"
                    "- 1 litro de óleo (Recomendado: Honda 10W30 Semissintético)\n"
                    "- Chave de boca ou soquete de 12mm\n"
                    "- Recipiente para coletar o óleo usado\n"
                    "- Funil\n"
                    "- Panos limpos\n\n"
                    "### Passo a Passo:\n"
                    "1. **Aqueça o motor**: Ligue a moto por 3 a 5 minutos para que o óleo fique mais fluido.\n"
                    "2. **Posicione a moto**: Deixe a moto em um local plano, preferencialmente no cavalete central.\n"
                    "3. **Drene o óleo**: Localize o parafuso de dreno na parte inferior do motor. Coloque o recipiente embaixo e solte o parafuso com a chave 12mm.\n"
                    "4. **Limpeza**: Limpe o parafuso de dreno e verifique a arruela de vedação. Se estiver muito amassada, troque-a.\n"
                    "5. **Feche o dreno**: Após o óleo parar de escorrer, recoloque o parafuso e aperte com cuidado (não force demais para não espanar a rosca).\n"
                    "6. **Abasteça**: Retire a vareta de óleo no lado direito do motor. Use o funil para colocar o novo óleo (1 litro).\n"
                    "7. **Verifique o nível**: Limpe a vareta, insira-a sem rosquear e verifique se o nível está entre as marcas.\n\n"
                    "**Dica**: Troque o óleo a cada 1.000km ou conforme o seu perfil de uso (severo ou urbano)."
                ),
            },
            {
                "title": "Guia de manutenção: Honda CB 300R (Problemas comuns e soluções)",
                "summary": "Saiba como cuidar da sua CB 300R e prevenir problemas conhecidos como o trincamento do cabeçote.",
                "body": (
                    "A Honda CB 300R é uma moto robusta, mas exige cuidados específicos para evitar dores de cabeça, especialmente com o famoso problema do cabeçote.\n\n"
                    "### Cuidados com o Motor:\n"
                    "- **Troca de óleo rigorosa**: Use sempre óleo de qualidade (10W30 ou 20W50 conforme o ano/manual) e respeite os prazos.\n"
                    "- **Velas de Irídio**: Muitos usuários recomendam o uso de velas de irídio para uma queima mais eficiente e menor aquecimento.\n"
                    "- **Ajuste de Válvulas**: O pastilhamento deve ser verificado periodicamente. Válvulas presas são um dos principais causadores de trincas no cabeçote.\n\n"
                    "### Outros itens de atenção:\n"
                    "- **Kit Relação**: Mantenha a corrente sempre limpa e lubrificada. O ajuste da folga deve ser feito a cada 500km.\n"
                    "- **Pneus**: A CB 300R usa pneus 110/70-17 na frente e 140/70-17 atrás. Mantenha a calibração em dia (29 psi frente / 33 psi atrás).\n\n"
                    "Lembre-se: Prevenção é sempre mais barata que o conserto!"
                ),
            },
            {
                "title": "Pressão dos pneus: A importância da calibração correta",
                "summary": "Entenda como a pressão correta afeta a segurança, o consumo e a durabilidade dos pneus da sua moto.",
                "body": (
                    "Você sabia que pneus murchos podem aumentar o consumo de combustível em até 10%? Além disso, a estabilidade da moto fica seriamente comprometida.\n\n"
                    "### Como saber a pressão correta?\n"
                    "A pressão ideal varia para cada modelo e se você está andando sozinho ou com garupa. Geralmente, você encontra essa informação:\n"
                    "- No manual do proprietário.\n"
                    "- Em um adesivo na balança traseira ou no protetor de corrente.\n\n"
                    "### Dicas para calibração:\n"
                    "1. **Calibre a frio**: Sempre calibre os pneus antes de rodar mais de 2km. Pneus quentes alteram a leitura da pressão.\n"
                    "2. **Frequência**: O ideal é verificar a pressão uma vez por semana.\n"
                    "3. **Carga**: Se for levar garupa ou carga pesada, aumente a pressão conforme indicado no manual (geralmente 2 a 4 psi a mais no pneu traseiro).\n\n"
                    "Manter os pneus calibrados garante que a área de contato com o solo seja a ideal, evitando desgastes irregulares e quedas em curvas."
                ),
            },
            {
                "title": "Honda CB 300F Twister 2023/2024: Primeiras manutenções",
                "summary": "Acabou de pegar a nova Twister? Veja o que você precisa saber sobre as primeiras revisões.",
                "body": (
                    "A nova Honda CB 300F Twister chegou com muitas novidades, incluindo embreagem assistida e deslizante. Se você é o feliz proprietário de uma, fique atento às primeiras manutenções.\n\n"
                    "### Revisão de 1.000km:\n"
                    "Esta é a revisão mais importante. Nela é feita a primeira troca de óleo e filtro, além de diversos reapertos e verificações de segurança. Não perca o prazo para manter a garantia!\n\n"
                    "### Especificações Rápidas:\n"
                    "- **Óleo**: Honda 10W30 Semissintético (aprox. 1,5 litros com troca de filtro).\n"
                    "- **Filtro de óleo**: Deve ser trocado em todas as revisões conforme o novo plano da Honda.\n"
                    "- **Combustível**: Aceita Gasolina e Etanol (Flex), mas a gasolina aditivada é recomendada para manter os bicos limpos.\n\n"
                    "A nova Twister é muito econômica, mas exige que você siga o plano de manutenção rigorosamente para desfrutar de toda a tecnologia embarcada."
                ),
            }
        ]

        created_count = 0
        for data in articles:
            slug = slugify(data["title"])
            if not ForumArticle.objects.filter(slug=slug).exists():
                ForumArticle.objects.create(
                    title=data["title"],
                    slug=slug,
                    summary=data["summary"],
                    body=data["body"],
                    is_published=True
                )
                self.stdout.write(self.style.SUCCESS(f"Artigo criado: {data['title']}"))
                created_count += 1
            else:
                self.stdout.write(self.style.WARNING(f"Artigo já existe: {data['title']}"))

        self.stdout.write(self.style.SUCCESS(f"Total de {created_count} novos artigos criados."))

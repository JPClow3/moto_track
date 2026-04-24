from __future__ import annotations

from dataclasses import dataclass

from django.http import HttpResponse
from django.template import loader
from django.views.decorators.csrf import requires_csrf_token


@dataclass(frozen=True)
class ErrorMeta:
    title: str
    message: str


ERROR_META = {
    400: ErrorMeta("Requisicao invalida", "Nao foi possivel processar esta requisicao."),
    403: ErrorMeta("Acesso negado", "Voce nao tem permissao para acessar esta area."),
    404: ErrorMeta("Pagina nao encontrada", "O endereco informado nao existe ou foi removido."),
    500: ErrorMeta("Erro interno", "Ocorreu uma falha inesperada no servidor."),
}


def _status_family_message(status_code: int) -> ErrorMeta:
    if status_code in ERROR_META:
        return ERROR_META[status_code]

    if 100 <= status_code <= 199:
        return ErrorMeta("Resposta informativa", "O servidor recebeu a solicitacao e continua o processamento.")
    if 200 <= status_code <= 299:
        return ErrorMeta("Operacao concluida", "A solicitacao foi processada com sucesso.")
    if 300 <= status_code <= 399:
        return ErrorMeta("Redirecionamento", "A requisicao precisa de uma etapa adicional para ser concluida.")
    if 400 <= status_code <= 499:
        return ErrorMeta("Falha na requisicao", "O servidor recebeu a requisicao, mas nao conseguiu processa-la.")
    return ErrorMeta("Falha no servidor", "Ocorreu um erro interno durante o processamento.")


def _render_error(request, status_code: int) -> HttpResponse:
    meta = _status_family_message(status_code)
    template = loader.get_template("errors/site_error.html")
    html = template.render(
        {
            "status_code": status_code,
            "title": meta.title,
            "message": meta.message,
            "request_id": getattr(request, "request_id", ""),
            "path": request.path,
        }
    )
    return HttpResponse(html, status=status_code)


def status_preview_view(request, status_code: int):
    return _render_error(request, status_code=status_code)


@requires_csrf_token
def handler400(request, exception):
    return _render_error(request, status_code=400)


@requires_csrf_token
def handler403(request, exception):
    return _render_error(request, status_code=403)


@requires_csrf_token
def handler404(request, exception):
    return _render_error(request, status_code=404)


@requires_csrf_token
def handler500(request):
    return _render_error(request, status_code=500)

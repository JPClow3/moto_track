with open('C:\\Code\\Personal\\moto_track\\templates\\cotton\\topbar.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('{% block topbar_eyebrow %}Moto Track{% endblock %}', '{{ eyebrow|default:"Moto Track"|safe }}')
content = content.replace('{% block topbar_title %}Controle da sua moto em um só lugar{% endblock %}', '{{ title|default:"Controle da sua moto em um só lugar"|safe }}')
content = content.replace('{% block topbar_actions %}{% endblock %}', '{{ actions|safe }}')

with open('C:\\Code\\Personal\\moto_track\\templates\\cotton\\topbar.html', 'w', encoding='utf-8') as f:
    f.write(content)

with open('C:\\Code\\Personal\\moto_track\\templates\\base.html', 'r', encoding='utf-8') as f:
    base_content = f.read()

base_content = base_content.replace(
    '<c-topbar active_motorcycle="{{ active_motorcycle }}" garage_motorcycles="{{ garage_motorcycles }}" web_push_public_key="{{ web_push_public_key }}" />',
    '<c-topbar active_motorcycle="{{ active_motorcycle }}" garage_motorcycles="{{ garage_motorcycles }}" web_push_public_key="{{ web_push_public_key }}">\n' +
    '  <c-slot name="eyebrow">{% block topbar_eyebrow %}Moto Track{% endblock %}</c-slot>\n' +
    '  <c-slot name="title">{% block topbar_title %}Controle da sua moto em um só lugar{% endblock %}</c-slot>\n' +
    '  <c-slot name="actions">{% block topbar_actions %}{% endblock %}</c-slot>\n' +
    '</c-topbar>'
)

with open('C:\\Code\\Personal\\moto_track\\templates\\base.html', 'w', encoding='utf-8') as f:
    f.write(base_content)

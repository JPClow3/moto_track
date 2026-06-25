import re

with open('C:\\Code\\Personal\\moto_track\\templates\\base.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract sidebar
sidebar_match = re.search(r'    <aside.*?</aside>\n', content, re.DOTALL)
if sidebar_match:
    sidebar_content = sidebar_match.group(0).strip()
    content = content.replace(sidebar_match.group(0), '    <c-sidebar active_motorcycle="{{ active_motorcycle }}" garage_motorcycles="{{ garage_motorcycles }}" billing_plan_label="{{ billing_plan_label }}" />\n')
    with open('C:\\Code\\Personal\\moto_track\\templates\\cotton\\sidebar.html', 'w', encoding='utf-8') as f:
        f.write(sidebar_content)

# Extract topbar
topbar_match = re.search(r'      <header.*?</header>\n', content, re.DOTALL)
if topbar_match:
    topbar_content = topbar_match.group(0).strip()
    content = content.replace(topbar_match.group(0), '      <c-topbar active_motorcycle="{{ active_motorcycle }}" garage_motorcycles="{{ garage_motorcycles }}" web_push_public_key="{{ web_push_public_key }}" />\n')
    with open('C:\\Code\\Personal\\moto_track\\templates\\cotton\\topbar.html', 'w', encoding='utf-8') as f:
        f.write(topbar_content)

# Extract quick_form_modal
quick_form_match = re.search(r'  <div id="quick-form-root" aria-live="polite"></div>\n\n  <div id="quick-form-skeleton".*?</div>\n    </div>\n  </div>\n', content, re.DOTALL)
if quick_form_match:
    quick_form_content = quick_form_match.group(0).strip()
    # Also replace animate-pulse with skeleton-group if we were going to do that, but wait, the prompt said "Currently using inline styles for loading states"
    # Actually, we can just remove `animate-pulse space-y-4` and add `.skeleton-group space-y-4` or just keep `space-y-4` since `skeleton-line` has its own shimmer.
    quick_form_content = quick_form_content.replace('animate-pulse', '')
    content = content.replace(quick_form_match.group(0), '  <c-quick-form-modal />\n')
    with open('C:\\Code\\Personal\\moto_track\\templates\\cotton\\quick_form_modal.html', 'w', encoding='utf-8') as f:
        f.write(quick_form_content)

# Extract toast_container
toast_match = re.search(r'  <div id="toast-container" hx-get="{% url \'message_list\' %}".*?</div>\n\n  <div id="client-snackbar" class="snackbar hidden" role="status" aria-live="polite"></div>\n', content, re.DOTALL)
if toast_match:
    toast_content = toast_match.group(0).strip()
    content = content.replace(toast_match.group(0), '  <c-toast-container />\n')
    with open('C:\\Code\\Personal\\moto_track\\templates\\cotton\\toast_container.html', 'w', encoding='utf-8') as f:
        f.write(toast_content)

with open('C:\\Code\\Personal\\moto_track\\templates\\base.html', 'w', encoding='utf-8') as f:
    f.write(content)

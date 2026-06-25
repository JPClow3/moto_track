import os

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # replace literal \n with actual newline
    content = content.replace('\\n', '\n')
    
    # fix the double @layer components
    content = content.replace('@layer components {\n@layer components {\n', '@layer components {\n')
    content = content.replace('@layer components {\n@layer components {', '@layer components {\n')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

fix_file('C:\\Code\\Personal\\moto_track\\static\\css\\components.css')
fix_file('C:\\Code\\Personal\\moto_track\\static\\css\\landing.css')
fix_file('C:\\Code\\Personal\\moto_track\\static\\css\\dashboard.css')

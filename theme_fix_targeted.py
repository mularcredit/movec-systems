import os
import re

directory = './frontend/src'

# Only these specific problematic patterns - not a blanket sweep
replacements = [
    # These are the harsh visible borders that show as white lines
    (r'\bborder-slate-50\b', 'border-white/5'),
    (r'\bborder-slate-100\b', 'border-white/5'),
    (r'\bborder-slate-200\b', 'border-white/10'),
    
    # bg-slate-200 used as progress bar tracks, dividers, toggle tracks (visible bright elements)
    (r'\bbg-slate-200\b', 'bg-white/10'),
    (r'\bbg-slate-50\b', 'bg-white/5'),
    (r'\bbg-slate-100\b', 'bg-white/5'),
    
    # hover states that flash white
    (r'hover:bg-slate-200\b', 'hover:bg-white/10'),
    (r'hover:bg-slate-100\b', 'hover:bg-white/5'),
    (r'hover:bg-slate-50\b', 'hover:bg-white/5'),
    
    # Text colors that are dark-on-dark
    (r'\btext-slate-200\b', 'text-white/30'),
]

changed_files = 0
total_replacements = 0

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            file_replacements = 0
            for regex, replacement in replacements:
                new_content, count = re.subn(regex, replacement, new_content)
                file_replacements += count
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                changed_files += 1
                total_replacements += file_replacements
                print(f"  Fixed {file_replacements} instances in {filepath.replace('./frontend/src/', '')}")

print(f"\nTotal: {total_replacements} fixes across {changed_files} files.")

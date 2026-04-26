import os
import re

directory = './frontend/src'

# Fix 1: Modal backdrops - make them darker so modal content is readable
# Fix 2: PaymentMonitor/Dashboard chart grid lines - white -> purple faint
# Fix 3: Packages and AllUsers modal icon boxes bg-rose-50/bg-emerald-50 -> dark tinted
# Fix 4: Packages type badges bg-blue-50 -> dark tinted
# Fix 5: Delete hover bg-rose-50 -> dark tinted
# Fix 6: Amber sync button -> accent purple

replacements = [
    # Modal backdrops: much more opaque
    ('bg-black/40 backdrop-blur-sm', 'bg-black/70 backdrop-blur-md'),
    
    # PaymentMonitor + any other chart grid stroke white color
    ('stroke="#f8fafc"', 'stroke="rgba(167,139,250,0.08)"'),
    ('stroke="#f1f5f9"', 'stroke="rgba(167,139,250,0.08)"'),
    ('stroke="#e2e8f0"', 'stroke="rgba(167,139,250,0.08)"'),
    
    # Chart tooltip light backgrounds
    ("border: '1px solid #f1f5f9'", "border: '1px solid rgba(167,139,250,0.2)'"),
    
    # Modal icon boxes in AllUsers (rose-50 / emerald-50)
    ("bg-rose-50' : 'bg-emerald-50'", "bg-rose-500/15' : 'bg-emerald-500/15'"),
    
    # Packages: type badges 
    ('bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full', 
     'bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full'),
    ('bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full', 
     'bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full'),
    
    # Packages: profile name badges
    ('bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded',
     'bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded'),
    ('bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded',
     'bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded'),

    # Delete dropdown items hover flash
    ('hover:bg-rose-50 flex items-center gap-2 transition', 
     'hover:bg-rose-500/10 flex items-center gap-2 transition'),

    # Amber sync button -> accent purple
    ('bg-amber-500 text-white text-[13px] font-medium hover:bg-amber-600 transition flex items-center gap-2 disabled:opacity-70',
     'bg-violet-500/20 text-violet-300 border border-violet-500/30 text-[13px] font-medium hover:bg-violet-500/30 transition flex items-center gap-2 disabled:opacity-70'),
]

changed_files = 0
total_fixes = 0

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.css')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            file_fixes = 0
            for old, new in replacements:
                if old in new_content:
                    new_content = new_content.replace(old, new)
                    file_fixes += 1

            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                changed_files += 1
                total_fixes += file_fixes
                print(f"  {file_fixes} fix(es) in {filepath.replace('./frontend/src/', '')}")

print(f"\nTotal: {total_fixes} fixes across {changed_files} files.")

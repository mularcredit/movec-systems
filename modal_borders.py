import os

directory = './frontend/src'

# All modal card patterns found, add a thin slick border to each
replacements = [
    (
        'bg-bgSecondary rounded-2xl shadow-2xl max-w-md w-full p-7 animate-in zoom-in-95 duration-200',
        'bg-bgSecondary rounded-2xl shadow-2xl max-w-md w-full p-7 animate-in zoom-in-95 duration-200 border border-[rgba(167,139,250,0.18)]'
    ),
    (
        'bg-bgSecondary rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200',
        'bg-bgSecondary rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200 border border-[rgba(167,139,250,0.18)]'
    ),
    (
        'bg-bgSecondary rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in zoom-in-95 duration-200',
        'bg-bgSecondary rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in zoom-in-95 duration-200 border border-[rgba(167,139,250,0.18)]'
    ),
    (
        'bg-bgSecondary rounded-2xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200',
        'bg-bgSecondary rounded-2xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 border border-[rgba(167,139,250,0.18)]'
    ),
    (
        'relative bg-bgSecondary rounded-2xl shadow-xl w-full max-w-md p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200',
        'relative bg-bgSecondary rounded-2xl shadow-xl w-full max-w-md p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-[rgba(167,139,250,0.18)]'
    ),
]

changed = 0
for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx'):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()
            new = content
            for old, new_val in replacements:
                new = new.replace(old, new_val)
            if new != content:
                with open(path, 'w') as f:
                    f.write(new)
                changed += 1
                print(f"  Bordered modal in {file}")

print(f"\nDone. {changed} files updated.")

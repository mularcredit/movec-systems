import os

base_dir = '/Users/mac/Desktop/ISP BILLING/frontend/src/pages'

for root, _, files in os.walk(base_dir):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()
            if 'IconServerRack' in content:
                content = content.replace('IconServerRack', 'IconServer')
                with open(filepath, 'w') as f:
                    f.write(content)
                print(f"Fixed {filepath}")

import os

files = [
    'src/pages/Settings.tsx',
    'src/pages/Customers/ActiveUsers.tsx',
    'src/pages/Customers/AddCustomer.tsx',
    'src/pages/Customers/AllUsers.tsx',
    'src/pages/Dashboard.tsx',
    'src/pages/Network/Routers/RoutersList.tsx',
    'src/pages/Network/Routers/RouterDetail.tsx',
    'src/pages/Payments.tsx',
    'src/pages/Packages/AddPackage.tsx',
    'src/pages/Communication/Communication.tsx'
]

base_dir = '/Users/mac/Desktop/ISP BILLING/frontend'

for f in files:
    p = os.path.join(base_dir, f)
    with open(p, 'r') as file:
        content = file.read()
    
    depth = len(f.split('/')) - 2
    relative = './lib/apiClient' if depth == 0 else '../' * depth + 'lib/apiClient'
    
    if 'apiFetch' not in content:
        import_stmt = f"import {{ apiFetch }} from '{relative}';\n"
        lines = content.split('\n')
        last_import = 0
        for i, line in enumerate(lines):
            if line.startswith('import '):
                last_import = i
        
        lines.insert(last_import + 1, import_stmt.strip())
        content = '\n'.join(lines)
    
    import re
    content = re.sub(r'\bfetch\(', 'apiFetch(', content)
    
    with open(p, 'w') as file:
        file.write(content)
    print(f"Refactored {f}")

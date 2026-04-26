import os
import re

files_to_fix = [
    "src/pages/Communication/Communication.tsx",
    "src/pages/Customers/CustomerProfile.tsx",
    "src/pages/Customers/EditCustomer.tsx",
    "src/pages/Network/Routers/RouterDetail.tsx",
    "src/pages/Packages/AddPackage.tsx",
    "src/pages/Packages/EditPackage.tsx"
]

base_dir = "/Users/mac/Desktop/ISP BILLING/frontend"

for rel_path in files_to_fix:
    full_path = os.path.join(base_dir, rel_path)
    with open(full_path, "r") as f:
        content = f.read()
    
    if "import CustomLoader" not in content:
        # Determine depth
        # For src/pages/Communication/Communication.tsx, depth is from src/pages/Communication -> src
        # That's 2 levels. rel_path.split('/') = ['src', 'pages', 'Communication', 'Communication.tsx']
        # length is 4. depth = length - 2 = 2.
        parts = rel_path.split('/')
        depth = len(parts) - 2
        prefix = "../" * depth
        import_stmt = f"import CustomLoader from '{prefix}components/common/CustomLoader';\n"
        
        if "from 'lucide-react';" in content:
            content = re.sub(r"(import .* from 'lucide-react';)", r"\1\n" + import_stmt, content)
        else:
            content = import_stmt + content
            
        with open(full_path, "w") as f:
            f.write(content)

print("Imports added")

import os

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
        parts = rel_path.split('/')
        depth = len(parts) - 2
        prefix = "../" * depth
        import_stmt = f"import CustomLoader from '{prefix}components/common/CustomLoader';\n"
        
        # Insert right after the first line (usually import React...)
        lines = content.split('\n')
        lines.insert(1, import_stmt.strip())
        
        with open(full_path, "w") as f:
            f.write('\n'.join(lines))
            print(f"Fixed {rel_path}")

print("Done.")

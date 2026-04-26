import os
import re

directory = '/Users/mac/Desktop/ISP BILLING/frontend/src/pages'

import_statement = "import CustomLoader from '../../components/common/CustomLoader';"
# Note: we will adjust the import path based on the depth of the file

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()

            if 'Loader2' in content and 'lucide-react' in content:
                # Determine depth for import
                rel_path = os.path.relpath(filepath, directory)
                depth = rel_path.count(os.sep)
                if depth == 0:
                    import_str = "import CustomLoader from '../components/common/CustomLoader';\n"
                elif depth == 1:
                    import_str = "import CustomLoader from '../../components/common/CustomLoader';\n"
                else:
                    import_str = "import CustomLoader from '../../../components/common/CustomLoader';\n"
                
                # Check if CustomLoader already imported
                if 'CustomLoader' not in content:
                    # Insert import after lucide-react import
                    content = re.sub(r"(import .* from 'lucide-react';)", r"\1\n" + import_str, content)

                # Replace full screen Loader2 (with mb-4 or similar)
                # Let's replace any <Loader2 className="... animate-spin..." /> with <CustomLoader />
                # if it's large (w-6 or w-8)
                content = re.sub(r'<Loader2 className="w-[68] h-[68] [^"]*animate-spin[^"]*" />', r'<CustomLoader />', content)
                
                # For small inline ones (w-4 or w-5), replace with inline CustomLoader
                content = re.sub(r'<Loader2 className="w-[45] h-[45] [^"]*animate-spin[^"]*" />', r'<CustomLoader inline size="sm" />', content)
                
                # Catch remaining Loader2 with mr-2 or similar
                content = re.sub(r'<Loader2 [^>]*animate-spin[^>]* />', r'<CustomLoader inline size="sm" />', content)

                with open(filepath, 'w') as f:
                    f.write(content)

print("Done replacing loaders")

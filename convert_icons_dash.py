import re
import os

filepath = '/Users/mac/Desktop/ISP BILLING/frontend/src/pages/Dashboard.tsx'

with open(filepath, 'r') as f:
    content = f.read()

# Tabler mappings
mappings = {
    'Users': 'IconUsers',
    'UserX': 'IconUserX',
    'AlertTriangle': 'IconAlertTriangle',
    'Clock': 'IconClock',
    'Server': 'IconServerRack',
    'CheckCircle2': 'IconCircleCheck',
    'CreditCard': 'IconCreditCard',
    'Wallet': 'IconWallet',
    'Activity': 'IconActivity',
    'Zap': 'IconBolt',
    'ArrowUpRight': 'IconArrowUpRight',
    'Signal': 'IconAntenna'
}

# Replace the import block
import_block = """import { 
  Users, UserX, AlertTriangle, Clock, Server, CheckCircle2, 
  CreditCard, Wallet, Activity, Zap, ArrowUpRight, Signal
} from 'lucide-react';"""

tabler_import = "import { " + ", ".join(mappings.values()) + " } from '@tabler/icons-react';"

if import_block in content:
    content = content.replace(import_block, tabler_import)

# Replace the JSX tags
for old_tag, new_tag in mappings.items():
    content = re.sub(rf"<{old_tag}\b", f"<{new_tag}", content)

with open(filepath, 'w') as f:
    f.write(content)

print("Icons converted in Dashboard.")

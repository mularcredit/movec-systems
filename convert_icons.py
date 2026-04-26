import re
import os

filepath = '/Users/mac/Desktop/ISP BILLING/frontend/src/pages/Network/RouterStats/RouterStats.tsx'

with open(filepath, 'r') as f:
    content = f.read()

# Tabler mappings
mappings = {
    'Cpu': 'IconCpu',
    'MemoryStick': 'IconRam',
    'Activity': 'IconActivity',
    'Wifi': 'IconWifi',
    'RefreshCw': 'IconRefresh',
    'AlertTriangle': 'IconAlertTriangle',
    'CheckCircle': 'IconCircleCheck',
    'XCircle': 'IconCircleX',
    'ArrowUpRight': 'IconArrowUpRight',
    'ArrowDownLeft': 'IconArrowDownLeft',
    'Radio': 'IconRouter',
    'Server': 'IconServerRack',
    'Clock': 'IconClock'
}

# Replace the import block
import_block = """import { 
  Cpu, MemoryStick, Activity, Wifi, RefreshCw, 
  AlertTriangle, CheckCircle, XCircle, ArrowUpRight,
  ArrowDownLeft, Radio, Server, Clock
} from 'lucide-react';"""

tabler_import = "import { " + ", ".join(mappings.values()) + " } from '@tabler/icons-react';"

if import_block in content:
    content = content.replace(import_block, tabler_import)

# Replace the JSX tags
for old_tag, new_tag in mappings.items():
    content = re.sub(rf"<{old_tag}\b", f"<{new_tag}", content)

with open(filepath, 'w') as f:
    f.write(content)

print("Icons converted in RouterStats.")
